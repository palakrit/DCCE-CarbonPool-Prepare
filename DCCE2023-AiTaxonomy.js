
const fs = require('fs');
const readline = require('readline');
const path = require('path');

const { google } = require('googleapis');
var xl = require('excel4node');

var outName = 'DCCE2023-AiTaxonomy';
var outColumns = ['File Name', 'File ID', 'Folder'];

var row = 1;
var wb = new xl.Workbook();
var ws = wb.addWorksheet('FileList');

// Scopes
const SCOPES = ['https://www.googleapis.com/auth/drive.metadata.readonly'];
const TOKEN = 'EnviModeling-Token.json';
const CREDENTIAL = 'EnviModeling-Credential.json';

// Load credentials and authorize
fs.readFile(CREDENTIAL, (err, content) => {
    if (err) return console.error('Error loading credentials.json', err);
    authorize(JSON.parse(content), listImagesInFolder);
});

function authorize(credentials, callback) {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2 = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    fs.readFile(TOKEN, (err, token) => {
        if (err) return getNewToken(oAuth2, callback);
        oAuth2.setCredentials(JSON.parse(token));
        callback(oAuth2);
    });
}

function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Enter the code from that page here: ', code => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error getting token', err);
            oAuth2Client.setCredentials(token);
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
            callback(oAuth2Client);
        });
    });
}

//https://drive.google.com/drive/folders/19zRDGONAU5IkTem-z4hvTBJePq57fylV?usp=sharing
function listImagesInFolder() {
    /*
    //const folderId = Browser.inputBox('19zRDGONAU5IkTem-z4hvTBJePq57fylV');
    const folderId = '19zRDGONAU5IkTem-z4hvTBJePq57fylV';
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    console.log(sheet);

    sheet.clear();
    sheet.appendRow(['File Name', 'File ID', 'Folder Path']);
    */
    ws.cell(row, 1).string(outColumns[0]);
    ws.cell(row, 2).string(outColumns[1]);
    ws.cell(row, 3).string(outColumns[2]);

    const folder = DriveApp.getFolderById(folderId);
    traverseFolder(folder, '', sheet);

    wb.write(outName);

}

function traverseFolder(folder, path, sheet) {
    const folderName = folder.getName();
    const currentPath = path ? `${path}/${folderName}` : folderName;

    // List image files in current folder
    const files = folder.getFiles();
    while (files.hasNext()) {
        const file = files.next();
        row += 1;
        if (isImageFile(file)) {
            /*
            sheet.appendRow([
                file.getName(),
                file.getId(),
                currentPath
            ]);
            */
            ws.cell(row, 1).string(file.getName());
            ws.cell(row, 2).string(file.getId());
            ws.cell(row, 3).string(currentPath);
        }
    }

    // Recurse into subfolders
    const subfolders = folder.getFolders();
    while (subfolders.hasNext()) {
        const subfolder = subfolders.next();
        traverseFolder(subfolder, currentPath, sheet);
    }
}

function isImageFile(file) {
    const imageTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/bmp',
        'image/svg+xml',
        'image/webp',
        'image/tiff',
        'image/heif',
        'image/heic-sequence'
    ];
    return imageTypes.includes(file.getMimeType());
}
