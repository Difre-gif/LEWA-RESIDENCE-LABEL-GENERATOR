import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { Duplex } from "stream";   // ✅ ESM-friendly import

const app = express();
const PORT = process.env.PORT || 3000;  // ✅ better for deployment

// Middleware
app.use(bodyParser.json({ limit: "10mb" }));
app.use(express.static("public"));

// ---- GOOGLE DRIVE SETUP ----
// Ensure you have your service account JSON renamed to "service-account.json"
// Place it in your project root
const KEYFILEPATH = path.join(process.cwd(), "service-account.json");
const SCOPES = ["https://www.googleapis.com/auth/drive"];

// Authenticate with service account
const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});

const drive = google.drive({ version: "v3", auth });

// Shared folder ID (must be shared with your service account as Editor)
const FOLDER_ID = "1mGIzA3T95ZApR55EdgU2ThPn59cOEIds";

// ---- SAVE LABEL ENDPOINT ----
app.post("/save-label", async (req, res) => {
  try {
    const { email, imageBase64 } = req.body;
    if (!email || !imageBase64) {
      return res.status(400).json({
        success: false,
        message: "❌ Email and image required.",
      });
    }

    // Safe filename from email
    const emailSafe = email.replace(/[^a-z0-9]/gi, "_").toLowerCase() + ".png";
    const buffer = Buffer.from(
      imageBase64.replace(/^data:image\/png;base64,/, ""),
      "base64"
    );

    // Check if file already exists in the Drive folder
    const existing = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and name='${emailSafe}' and trashed=false`,
      fields: "files(id, name)",
    });

    if (existing.data.files.length > 0) {
      // ✅ Replace existing file inside the same folder
      const fileId = existing.data.files[0].id;
      await drive.files.update({
        fileId,
        media: { mimeType: "image/png", body: BufferToStream(buffer) },
        addParents: FOLDER_ID, // ✅ force it to stay in folder
      });
      return res.json({
        success: true,
        message: "✅ Label updated in Google Drive!",
      });
    } else {
      // ✅ Upload new file into shared folder
      const fileMetadata = {
        name: emailSafe,
        parents: [FOLDER_ID],
      };
      await drive.files.create({
        resource: fileMetadata,
        media: { mimeType: "image/png", body: BufferToStream(buffer) },
        fields: "id",
      });
      return res.json({
        success: true,
        message: "✅ Label saved in Google Drive!",
      });
    }
  } catch (err) {
    console.error("Drive upload error:", err);
    res.status(500).json({
      success: false,
      message: "❌ Failed to save label. Check folder sharing & service account permissions.",
    });
  }
});

// ✅ Helper: Convert buffer to readable stream
function BufferToStream(buffer) {
  const stream = new Duplex();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

// ---- START SERVER ----
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📂 Make sure folder ${FOLDER_ID} is shared with your service account email as Editor`);
});
