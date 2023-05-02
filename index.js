const Airtable = require("airtable");
const axios = require("axios");
const fs = require("fs").promises;
// retrieve the API keys and workspace IDs from the .env file
require("dotenv").config();
const {
  AIRTABLE_API_KEY,
  AIRTABLE_SOURCE_BASE_ID,
  AIRTABLE_DESTINATION_BASE_ID,
} = process.env;

Airtable.configure({ apiKey: AIRTABLE_API_KEY });

const sourceBase = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(
  AIRTABLE_SOURCE_BASE_ID
);
const destinationBase = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(
  AIRTABLE_DESTINATION_BASE_ID
);

async function downloadFile(url, localPath) {
  const response = await axios.get(url, { responseType: "stream" });
  const fileWriter = fs.createWriteStream(localPath);
  response.data.pipe(fileWriter);
  return new Promise((resolve, reject) => {
    fileWriter.on("finish", resolve);
    fileWriter.on("error", reject);
  });
}

async function copyBases() {
  const baseNames = [""];
  const bases = await listBases();
  
  for (const baseName of baseNames) {
    const existingBase = bases.find((base) => base.name === baseName);

  if (existingBase) {
    console.log("Deleting existing base:", existingBase.id);
    await deleteBase(existingBase.id);
  }
    const records = await sourceBase(baseName).select().all();

    for (const record of records) {
      const fields = record.fields;

      if (fields.Attachments) {
        const attachments = [];
        for (const attachment of fields.Attachments) {
          const localPath = `/tmp/${attachment.filename}`;
          await downloadFile(attachment.url, localPath);
          const file = await fs.readFile(localPath);
          attachments.push({
            filename: attachment.filename,
            content: Buffer.from(file).toString("base64"),
          });
        }
        fields.Attachments = attachments.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
        }));
      }
      console.log("Create destination base:", existingBase.id);
      await destinationBase(baseName).create([{ fields }]);
    }
  }
}

const listBases = async () => {
  const metaBase = new Airtable().base("app12345");
  const bases = await metaBase("Bases").select().all();
  return bases.map((base) => ({ id: base.id, name: base.get("Name") }));
};

const deleteBase = async (baseId) => {
  const metaBase = new Airtable().base("app12345");
  await metaBase("Bases").destroy(baseId);
};


const main = async () => {
  
  copyBases().catch(console.error);
};

main();
