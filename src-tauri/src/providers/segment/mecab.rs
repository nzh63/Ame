//! MeCab word segmentation provider via subprocess.

#![allow(dead_code)]

use std::io::{Read, Write};
use std::process::{Command, Stdio};

use encoding_rs::{Encoding, EUC_JP, SHIFT_JIS, UTF_16LE, UTF_8};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::SegmentProvider;
use crate::schema::{AmeOptions, JsonSchema};

#[derive(Debug, Clone, Deserialize, Serialize, JsonSchema, AmeOptions)]
#[serde(rename_all = "camelCase")]
pub struct MecabOptions {
    #[ame(desc = "启用")]
    #[serde(default)]
    pub enable: bool,
    #[ame(desc = "mecab.exe路径")]
    #[serde(default = "default_exe")]
    pub exe_path: String,
    #[ame(desc = "编码格式")]
    #[serde(default = "default_enc")]
    pub encoding: MecabEncoding,
}

fn default_exe() -> String {
    "C:/Program Files (x86)/MeCab/bin/mecab.exe".into()
}
/// MeCab subprocess text encoding.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize, Serialize, JsonSchema)]
pub enum MecabEncoding {
    #[default]
    #[serde(rename = "Shift_JIS")]
    ShiftJis,
    #[serde(rename = "UTF-8")]
    Utf8,
    #[serde(rename = "UTF-16")]
    Utf16,
    #[serde(rename = "EUC-JP")]
    EucJp,
}

fn default_enc() -> MecabEncoding {
    MecabEncoding::default()
}

impl Default for MecabOptions {
    fn default() -> Self {
        Self {
            enable: false,
            exe_path: default_exe(),
            encoding: default_enc(),
        }
    }
}

pub struct Mecab {
    pub options: MecabOptions,
}

impl Mecab {
    pub fn new(options: MecabOptions) -> Self {
        Self { options }
    }

    fn encoding(&self) -> &'static Encoding {
        match self.options.encoding {
            MecabEncoding::ShiftJis => SHIFT_JIS,
            MecabEncoding::Utf8 => UTF_8,
            MecabEncoding::Utf16 => UTF_16LE,
            MecabEncoding::EucJp => EUC_JP,
        }
    }
}

impl SegmentProvider for Mecab {
    fn id(&self) -> &str {
        "mecab"
    }

    fn options_schema() -> Value {
        <MecabOptions as AmeOptions>::schema()
    }

    fn default_options() -> Value {
        serde_json::to_value(MecabOptions::default()).unwrap()
    }

    fn options_description() -> Value {
        <MecabOptions as AmeOptions>::description()
    }

    fn enabled(&self) -> bool {
        self.options.enable && std::path::Path::new(&self.options.exe_path).exists()
    }

    fn segment(&self, text: String) -> Vec<(String, Option<String>)> {
        let enc = self.encoding();
        let (encoded, _, _) = enc.encode(&text);

        let mut cmd = Command::new(&self.options.exe_path);
        crate::win32::hide_console(&mut cmd);
        let mut child = match cmd
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
        {
            Ok(c) => c,
            Err(_) => return Vec::new(),
        };

        if let Some(stdin) = child.stdin.as_mut() {
            let _ = stdin.write_all(&encoded);
        }
        drop(child.stdin.take());

        let mut out_bytes = Vec::new();
        if let Some(stdout) = child.stdout.as_mut() {
            let _ = stdout.read_to_end(&mut out_bytes);
        }
        let _ = child.wait();

        let (decoded, _, _) = enc.decode(&out_bytes);
        parse_mecab_output(&decoded)
    }
}

/// Parse MeCab output lines of the form `word\tdesc`.
fn parse_mecab_output(output: &str) -> Vec<(String, Option<String>)> {
    let mut results = Vec::new();
    for line in output.lines() {
        let line = line.trim();
        if line.is_empty() || line == "EOS" {
            continue;
        }
        let Some((word, desc)) = line.split_once('\t') else {
            continue;
        };
        let extra_info = parse_desc(word, desc);
        results.push((word.to_string(), extra_info));
    }
    results
}

/// Extract type/conjugation/original-form from the MeCab feature desc.
fn parse_desc(word: &str, desc: &str) -> Option<String> {
    // desc format: pos1,pos2,pos3,pos4,conjType,conjForm,original,...
    let parts: Vec<&str> = desc.split(',').collect();
    if parts.len() < 7 {
        return None;
    }
    let type_parts: Vec<&str> = parts[0..4].iter().copied().filter(|&s| s != "*").collect();
    let conj_parts: Vec<&str> = parts[4..6].iter().copied().filter(|&s| s != "*").collect();
    let original = parts[6];

    let type_str = type_parts.join("/");
    let conj_str = conj_parts.join("/");

    let mut info_parts: Vec<String> = Vec::new();
    if !type_str.is_empty() {
        info_parts.push(type_str);
    }
    if !conj_str.is_empty() {
        info_parts.push(conj_str);
    }
    if original != word && original != "*" {
        info_parts.push(format!("原形: {original}"));
    }

    if info_parts.is_empty() {
        None
    } else {
        Some(info_parts.join("\n"))
    }
}
