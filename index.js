const Airtable = require("airtable");
const axios = require("axios");
const fs = require("fs").promises;
// retrieve the API keys and workspace IDs from the .env file
require("dotenv").config();
const {
  AIRTABLE_API_KEY,
  AIRTABLE_SOURCE_WORKSPACE,
  AIRTABLE_DESTINATION_WORSPACE,
} = process.env;

Airtable.configure({ apiKey: AIRTABLE_API_KEY });

const sourceBase = Airtable.base(
  AIRTABLE_SOURCE_WORKSPACE
);
const destinationBase = Airtable.base(
  AIRTABLE_DESTINATION_WORSPACE
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
  // your table names
  const tableNames = ["table1", "table2"];
  
  for (const tableName of tableNames) {

    const records = await sourceBase(tableName).select().all();

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
      // The table name in the destination base must be the same as the source base
      // @todo: check if the table exists in the destination base and create it if it doesn't
      console.log("Create destination base:", tableName);
      await destinationBase(tableName).create([{ fields }]);
    }
  }
}

const main = async () => {
  
  copyBases().catch(console.error);
};

main();
