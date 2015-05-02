var auth = require('basic-auth')


module.exports = function(username, password, realm) {
  return function(req,res, next) {
    var credentials = auth(req);
    if (!credentials || credentials.name !== username || credentials.pass !== password) {
      res.writeHead(401, {
        'WWW-Authenticate': 'Basic realm="'+ realm +'"'
      })
      res.end();
    } else {
      next();
    }
  }
}