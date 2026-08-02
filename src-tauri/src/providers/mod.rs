//! Providers — replaces `src/main/providers/`.
//!
//! Each provider category (translate, tts, ocr, segment, dict) has a trait
//! and a set of concrete implementations.

pub mod dict;
pub mod ocr;
pub mod segment;
#[cfg(debug_assertions)]
pub mod selftest;
pub mod translate;
pub mod tts;

#[cfg(test)]
mod test;
