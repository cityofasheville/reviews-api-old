const pg = require('pg');
const sql = require('mssql');
const dbConfigurations = require('./db_configs');

const dbConnections = {};

pg.defaults.poolSize = 1;
const PgPool = pg.Pool;

const dbPool = (name) => {
  if (dbConfigurations[name] === undefined) {
    throw new Error(`Unknown database configuration ${name}`);
  }
  const cfg = dbConfigurations[name];
  if (cfg.db_type === 'pg') {
    return new PgPool(cfg);
  }
  if (cfg.db_type === 'mssql') {
    const pool = new sql.ConnectionPool(cfg);
    pool.on('error', (err) => {
      throw new Error(`Error on database connection pool: ${err}`);
    });

    pool.connect((err) => {
      if (err) {
        throw new Error(`Error trying to create a connection pool ${err}`);
      }
    });
    return pool;
  }
  throw new Error(`Unknown database type ${cfg.db_type}`);
};

const getDbConnection = (name) => {
  if (dbConnections[name] === undefined) {
    dbConnections[name] = dbPool(name);
  }
  return dbConnections[name];
};

module.exports = getDbConnection;
