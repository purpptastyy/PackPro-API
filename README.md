# PackPro-API

This project provides a simple file processing API built with Node.js and Express. It supports converting, compressing and manipulating files. Authentication is handled via an `x-api-key` header.

## Setup

```bash
npm install
npm start
```

The server runs on port `3000` by default.

## Endpoints
- `POST /convert/image?format=png` – convert uploaded image to the given format.
- `POST /convert/audio?format=mp3` – convert uploaded audio.
- `POST /convert/video?format=mp4` – convert uploaded video.
- `POST /compress/file` – zip the uploaded file.
- `POST /pdf/merge` – merge uploaded PDFs (use `files` field for multiple uploads).
- `POST /pdf/split` – split uploaded PDF into pages.
- `POST /pdf/compress` – compress a PDF.
- `POST /audio/trim` – trim an audio file (`start` and `duration` in body).
- `POST /gif/optimize` – optimize a GIF.

`x-api-key` header is required for all requests.
