const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, 'mobilidade.db');

function wrap(db) {
  return {
    exec(sql) {
      db.exec(sql);
    },
    prepare(sql) {
      const stmt = db.prepare(sql);
      return {
        all(...params) {
          return params.length ? stmt.all(...params) : stmt.all();
        },
        get(...params) {
          return params.length ? stmt.get(...params) : stmt.get();
        },
        run(...params) {
  return params.length
    ? stmt.run(...params)
    : stmt.run();
}
      };
    },
    close() {
      db.close();
    },
  };
}

function openDb() {
  return wrap(new DatabaseSync(DB_PATH));
}

function tableExists(db, name) {
  const row = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(name);
  return !!row;
}

module.exports = { openDb, DB_PATH, tableExists };
