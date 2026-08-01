# Canvas Studio AI Background Removal

Canvas Studio uses optional on-device salient-object segmentation for complex background removal.

- **Model:** U²-Net lightweight (`u2netp.onnx`)
- **Upstream:** `xuebinqin/U-2-Net`
- **Model mirror:** `Heliosoph/u2net-onnx`
- **Model license:** Apache License 2.0
- **Runtime:** ONNX Runtime Web
- **Runtime license:** MIT

The model and runtime are downloaded only when the user selects **Remove with AI**. The model is cached in IndexedDB after the first successful download. Image pixels are processed inside the browser and are not uploaded by Canvas Studio. Color-key removal remains available for solid backgrounds and does not require the AI model.
