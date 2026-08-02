//! Application-wide error type.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("store error: {0}")]
    Store(#[from] crate::store::StoreError),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("{0}")]
    Other(String),
}

pub type Result<T> = std::result::Result<T, Error>;
