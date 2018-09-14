module.exports = {
  aws: {
    db_type: 'pg',
    host: process.env.aws_host,
    user: process.env.aws_user,
    password: process.env.aws_password,
    database: process.env.aws_database,
    port: 5432,
    ssl: false,
  },
  mds: {
    db_type: 'pg',
    host: process.env.mds_host,
    user: process.env.mds_user,
    password: process.env.mds_password,
    database: process.env.mds_database,
    port: 5432,
    ssl: false,    
  },
};
