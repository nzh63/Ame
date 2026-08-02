#![allow(linker_messages)]

//! `#[derive(AmeOptions)]` — single-source options metadata.
//!
//! Given an options struct:
//!
//! ```ignore
//! #[derive(AmeOptions)]
//! #[serde(rename_all = "camelCase")]
//! pub struct OpenAiOptions {
//!     #[ame(desc = "启用")]
//!     pub enable: bool,
//!     #[ame]
//!     pub api_config: OpenAiApiConfig,
//!     #[ame(readable = "API Key", desc = "可在控制台获取")]
//!     pub api_key: String,
//!     #[ame(items = ["用户辞书1的路径", "用户辞书2的路径"])]
//!     pub user_dicts: Vec<String>,
//! }
//! ```
//!
//! The derive:
//! - adds `schemars::JsonSchema` so the schema is derived from the same type
//! - implements [`AmeOptions`] (defined in `ame_lib::schema`), generating the
//!   `description()` JSON from the `#[ame(...)]` field attributes
//!
//! `#[ame]` field attributes:
//! - `#[ame]` (no arguments) — recurse into a nested options struct
//! - `#[ame(desc = "...")]` — a plain string label
//! - `#[ame(readable = "...", desc = "...")]` — `{ readableName, description }`
//! - `#[ame(items = ["a", "b"])]` — an array of labels (expanded array fields)
//! - no `#[ame]` attribute — the key is omitted from the description

use proc_macro::TokenStream;
use quote::quote;
use syn::{
    parse_macro_input, Data, DeriveInput, Expr, Fields, Lit, Meta,
    punctuated::Punctuated, Token,
};

#[proc_macro_derive(AmeOptions, attributes(ame))]
pub fn derive_ame_options(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    match expand(&input) {
        Ok(tokens) => tokens.into(),
        Err(e) => e.to_compile_error().into(),
    }
}

fn expand(input: &DeriveInput) -> syn::Result<proc_macro2::TokenStream> {
    let name = &input.ident;
    let rename_all = container_rename_all(input);

    let fields = match &input.data {
        Data::Struct(data) => match &data.fields {
            Fields::Named(fields) => &fields.named,
            _ => {
                return Err(syn::Error::new_spanned(
                    name,
                    "AmeOptions can only be derived on structs with named fields",
                ))
            }
        },
        _ => {
            return Err(syn::Error::new_spanned(
                name,
                "AmeOptions can only be derived on structs",
            ))
        }
    };

    let mut entries: Vec<proc_macro2::TokenStream> = Vec::new();
    for field in fields {
        let field_name = field.ident.as_ref().expect("named field");
        let key = field_json_name(field_name.to_string(), field, rename_all.clone());
        let ame = field_ame_attr(field)?;

        let value = match ame {
            AmeAttr::Nested => {
                let ty = &field.ty;
                quote! { <#ty as crate::schema::AmeOptions>::description() }
            }
            AmeAttr::Desc(desc) => quote! { ::serde_json::json!(#desc) },
            AmeAttr::Readable { readable, desc } => quote! {
                ::serde_json::json!({
                    "readableName": #readable,
                    "description": #desc,
                })
            },
            AmeAttr::Items(items) => {
                quote! { ::serde_json::json!([#(#items),*]) }
            }
            AmeAttr::None => continue,
        };
        entries.push(quote! {
            map.insert(#key.into(), #value);
        });
    }

    let impl_block = quote! {
        impl crate::schema::AmeOptions for #name {
            fn description() -> ::serde_json::Value {
                use ::serde_json::Map;
                let mut map = Map::new();
                #(#entries)*
                ::serde_json::Value::Object(map)
            }
        }
    };

    Ok(impl_block)
}

enum AmeAttr {
    Nested,
    Desc(String),
    Readable { readable: String, desc: String },
    Items(Vec<String>),
    None,
}

fn field_ame_attr(field: &syn::Field) -> syn::Result<AmeAttr> {
    let mut attr_meta = None;
    for attr in &field.attrs {
        if attr.path().is_ident("ame") {
            attr_meta = Some(attr);
            break;
        }
    }
    let Some(attr) = attr_meta else {
        return Ok(AmeAttr::None);
    };

    // Bare `#[ame]` means "recurse into the nested options struct".
    if matches!(attr.meta, Meta::Path(_)) {
        return Ok(AmeAttr::Nested);
    }

    let list = attr.parse_args_with(
        Punctuated::<Meta, Token![,]>::parse_terminated,
    )?;
    let mut desc = None;
    let mut readable = None;
    let mut items = None;
    let mut nested = false;
    for meta in list {
        match meta {
            Meta::Path(_) => nested = true,
            Meta::NameValue(nv) => {
                let Some(key) = nv.path.get_ident().map(|i| i.to_string()) else {
                    continue;
                };
                match &nv.value {
                    Expr::Lit(expr) => {
                        if let Lit::Str(s) = &expr.lit {
                            match key.as_str() {
                                "desc" => desc = Some(s.value()),
                                "readable" => readable = Some(s.value()),
                                _ => {}
                            }
                        }
                    }
                    Expr::Array(arr) if key == "items" => {
                        let mut vals = Vec::new();
                        for expr in &arr.elems {
                            if let Expr::Lit(e) = expr {
                                if let Lit::Str(s) = &e.lit {
                                    vals.push(s.value());
                                }
                            }
                        }
                        items = Some(vals);
                    }
                    _ => {}
                }
            }
            _ => {}
        }
    }

    if let Some(items) = items {
        return Ok(AmeAttr::Items(items));
    }
    if let Some(desc) = desc {
        if let Some(readable) = readable {
            return Ok(AmeAttr::Readable { readable, desc });
        }
        return Ok(AmeAttr::Desc(desc));
    }
    if nested {
        return Ok(AmeAttr::Nested);
    }
    Ok(AmeAttr::None)
}

fn container_rename_all(input: &DeriveInput) -> Option<String> {
    for attr in &input.attrs {
        if !attr.path().is_ident("serde") {
            continue;
        }
        if let Ok(list) = attr
            .parse_args_with(Punctuated::<Meta, Token![,]>::parse_terminated)
        {
            for meta in list {
                if let Meta::NameValue(nv) = meta {
                    if nv.path.is_ident("rename_all") {
                        if let Expr::Lit(expr) = &nv.value {
                            if let Lit::Str(s) = &expr.lit {
                                return Some(s.value());
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

fn field_json_name(field_name: String, field: &syn::Field, rename_all: Option<String>) -> String {
    for attr in &field.attrs {
        if !attr.path().is_ident("serde") {
            continue;
        }
        if let Ok(list) = attr
            .parse_args_with(Punctuated::<Meta, Token![,]>::parse_terminated)
        {
            for meta in list {
                if let Meta::NameValue(nv) = meta {
                    if nv.path.is_ident("rename") {
                        if let Expr::Lit(expr) = &nv.value {
                            if let Lit::Str(s) = &expr.lit {
                                return s.value();
                            }
                        }
                    }
                }
            }
        }
    }
    rename_field(&field_name, rename_all.as_deref())
}

fn rename_field(name: &str, rename_all: Option<&str>) -> String {
    match rename_all {
        Some("camelCase") => {
            let mut out = String::new();
            let mut upper = false;
            for c in name.chars() {
                if c == '_' {
                    upper = true;
                } else if upper {
                    out.push(c.to_ascii_uppercase());
                    upper = false;
                } else {
                    out.push(c);
                }
            }
            out
        }
        Some("snake_case") | Some("lowercase") => name.to_string(),
        Some("kebab-case") => name.replace('_', "-"),
        Some("SCREAMING_SNAKE_CASE") => name.to_ascii_uppercase(),
        Some("pascalCase") => {
            let camel = rename_field(name, Some("camelCase"));
            let mut chars = camel.chars();
            match chars.next() {
                Some(first) => first.to_ascii_uppercase().to_string() + chars.as_str(),
                None => String::new(),
            }
        }
        _ => name.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use quote::quote;

    #[test]
    fn expansion_contains_struct_once_and_impl() {
        let input: DeriveInput = syn::parse2(quote! {
            #[derive(Debug, Clone)]
            #[serde(rename_all = "camelCase")]
            pub struct Sample {
                #[ame(desc = "启用")]
                pub enable: bool,
                #[ame]
                pub nested: Nested,
            }
        })
        .unwrap();
        let out = expand(&input).unwrap().to_string();
        // The derive only emits the impl (the struct itself stays as-is).
        assert!(!out.contains("struct Sample"), "output: {out}");
        assert!(out.contains("AmeOptions for Sample"), "output: {out}");
        assert!(out.contains("\"enable\""));
        assert!(out.contains("<Nested as crate::schema::AmeOptions>::description()"));
    }
}
