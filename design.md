                    ┌──────────────────────┐
                    │      React + Vite     │
                    │ Tailwind + Router     │
                    └──────────┬───────────┘
                               │ HTTPS
                               ▼
                    ┌──────────────────────┐
                    │ Node.js + Express API │
                    │                      │
                    │ Auth / RBAC          │
                    │ Documents            │
                    │ OCR / AI             │
                    │ Search               │
                    │ Audit                │
                    └───────┬───────┬──────┘
                            │       │
                 ┌──────────┘       └──────────┐
                 ▼                             ▼
        ┌────────────────┐             ┌──────────────┐
        │ MongoDB Atlas  │             │    AWS S3    │
        │                │             │              │
        │ Metadata       │             │ Raw files    │
        │ Users          │             │ SSE-S3       │
        │ Cases          │             │ encryption   │
        │ Documents      │             └──────────────┘
        │ Audit logs     │
        │ Embeddings     │
        └────────────────┘
                 │
                 ▼
        ┌────────────────────┐
        │ Gemini Vision API  │
        │ OCR / extraction   │
        │ classification     │
        └────────────────────┘