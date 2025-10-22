// list-drive-files.js (เวอร์ชันแก้ Bug + บังคับ Path)

const fs = require('fs').promises; 
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');

// --- (สำคัญ!) ตั้งค่าให้ตรงกับไฟล์ของคุณ ---
const CREDS_PATH = path.join(process.cwd(), 'DCCE-CarbonPool-Credential.json'); 
const START_FOLDER_ID = "17DsEtWg2aYlGxo2v8xp9HMhJtXx1E7xx"; 

// !!!!! (จุดที่แก้ไข) !!!!!
// บังคับให้มันบันทึกไฟล์ลงใน "โฟลเดอร์ปัจจุบัน" เท่านั้น
const OUTPUT_FILE = path.join(process.cwd(), 'drive_files.csv');
// !!!!! (จบจุดที่แก้ไข) !!!!!
// ------------------------------------------

async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

async function saveCredentials(client) {
  const content = await fs.readFile(CREDS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDS_PATH, 
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

// (สำคัญ!) เราต้องรีเซ็ตเนื้อหาไฟล์ใหม่ทุกครั้งที่รัน
let csvContent = "Path,Name,URL,Size(KB)\n"; 

async function listFilesRecursive(drive, folderId, currentPath) {
  let pageToken = null;
  
  // 1. ค้นหา "ไฟล์"
  console.log(`[FILES] 📂 กำลังค้นหาไฟล์ใน: ${currentPath}`);
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'nextPageToken, files(id, name, webViewLink, size)',
      pageSize: 1000, 
      pageToken: pageToken,
    });

    const files = res.data.files;
    if (files.length) {
      files.forEach(file => {
        const sizeKB = file.size ? (file.size / 1024).toFixed(2) : "0";
        const safeName = file.name.replace(/"/g, '""'); 
        const row = `"${currentPath}","${safeName}","${file.webViewLink}","${sizeKB}"\n`;
        csvContent += row; 
      });
      console.log(`  -> 🗂️ เจอไฟล์ ${files.length} ไฟล์...`);
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  // 2. ค้นหา "โฟลเดอร์ย่อย"
  console.log(`[FOLDERS] 📁 กำลังค้นหาโฟลเดอร์ย่อยใน: ${currentPath}`);
  pageToken = null; 
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: 'nextPageToken, files(id, name)',
      pageSize: 100,
      pageToken: pageToken,
    });

    const folders = res.data.files; // (แก้ Bug แล้ว)

    if (folders && folders.length) {
      for (const folder of folders) {
        const newPath = `${currentPath} / ${folder.name}`;
        await listFilesRecursive(drive, folder.id, newPath);
      }
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);
}

async function main() {
  try {
    console.log("กำลังขอสิทธิ์ (Authentication)...");
    const auth = await authorize(); 
    console.log("✅ ขอสิทธิ์สำเร็จ!");
    
    const drive = google.drive({version: 'v3', auth});

    console.log("🚀 เริ่มต้นการค้นหาไฟล์ทั้งหมด...");
    
    const rootFolder = await drive.files.get({
      fileId: START_FOLDER_ID,
      fields: 'name',
    });
    const rootPath = rootFolder.data.name;

    await listFilesRecursive(drive, START_FOLDER_ID, rootPath);

    console.log("\n🏁 ค้นหาเสร็จสิ้น! กำลังบันทึกผลลัพธ์ลงไฟล์...");
    
    // เราจะเขียนไฟล์ "ทับ" ของเดิม (ถ้ามี)
    await fs.writeFile(OUTPUT_FILE, csvContent, 'utf8'); 
    
    console.log(`✅ เรียบร้อย! ข้อมูลถูกบันทึกลงในไฟล์ ${OUTPUT_FILE} แล้ว`);

  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error.message);
  }
}

main();