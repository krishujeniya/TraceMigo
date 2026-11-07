import { readFile } from 'node:fs/promises';
import { createDatabase, migrateCore } from '../../packages/db/dist/index.js';
let handle;
try {
  const host=process.env.TRACEMIGO_DB_HOST, user=process.env.TRACEMIGO_DB_USER, database=process.env.TRACEMIGO_DB_NAME;
  if(!host || !user || !database) throw new Error('Database configuration is required.');
  const portText=process.env.TRACEMIGO_DB_PORT ?? '5432';
  if(!/^[1-9][0-9]*$/.test(portText)) throw new Error('Invalid database port.');
  const passwordFile=process.env.TRACEMIGO_DB_PASSWORD_FILE;
  const caFile=process.env.TRACEMIGO_DB_CA_FILE;
  const password=passwordFile ? (await readFile(passwordFile,'utf8')).replace(/\r?\n$/,'') : undefined;
  const ssl=caFile ? {rejectUnauthorized:true,ca:await readFile(caFile,'utf8')} : undefined;
  handle=createDatabase({host,user,database,port:Number(portText),...(password===undefined ? {} : {password}),...(ssl ? {ssl} : {})});
  const applied=await migrateCore(handle.db);
  console.log(JSON.stringify({event:'database_migrated',applied}));
} catch {
  console.error(JSON.stringify({event:'database_migration_failed'}));
  process.exitCode=1;
} finally { if(handle) await handle.destroy(); }
