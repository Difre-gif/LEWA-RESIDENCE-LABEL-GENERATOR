import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";

const app = express();
const PORT = 3000;

app.use(bodyParser.json({ limit: "10mb" }));
app.use(express.static("public"));
app.use("/images", express.static("images"));

const imagesDir = path.join(process.cwd(), "images");
if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir);

app.post("/save-label", (req, res) => {
  const { email, imageBase64 } = req.body;
  if (!email || !imageBase64) {
    return res.status(400).json({ success: false, message: "Email and image required." });
  }
  const emailSafe = email.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const filePath = path.join(imagesDir, `${emailSafe}.png`);
  const imageData = imageBase64.replace(/^data:image\/png;base64,/, "");
  fs.writeFile(filePath, imageData, "base64", (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: "Failed to save image." });
    }
    res.json({ success: true, message: "Label saved successfully!" });
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
