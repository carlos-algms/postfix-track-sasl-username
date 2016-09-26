var readline = require('readline');
var fs = require('fs');

var FILE_PATH = '/var/log/' + (process.argv[2] || 'mail.log');
var users = [];
var lineReader = readline.createInterface({
  input: fs.createReadStream(FILE_PATH)
});

console.info('File path: ', FILE_PATH);

lineReader.on('line', function (line) {
  var saslUsername = line.match(/sasl_username=(.*)/);

  if (!saslUsername) {
    return;
  }

  var user = getUser( saslUsername[1] );
  user.count++;


  var code = line.match(/[A-Z0-9]{10}/);
  user.codes.push(code[0]);
});

lineReader.on('close', function() {
  readOccurrences();
});


function getUser(username) {
  var user = null;
  users.some(function (u) {
    if (u.name == username) {
      user = u;
      return true;
    }
    return false;
  });

  if (!user) {
    user = {
      name: username,
      count: 0,
      codes: [],
      occurrences: []
    };

    users.push(user);
  }
  return user;
}


// //////////////////////////////////


function readOccurrences() {
  var postfixDataRegex = /([A-Z][a-z]{2}\s+[0-9]{1,2} [0-9]{2}:[0-9]{2}:[0-9]{2}) .* postfix\/(.*)\[([0-9]+)\]/;
  var hostIpRegex = /client=(.*?)\[([0-9\.]+)\]/i;
  var emailToRegex = /to=<(.*?)>/i;
  var emailFromRegex = /from=<(.*?)>/i;

  lineReader = readline.createInterface({
    input: fs.createReadStream(FILE_PATH)
  });

  lineReader.on('line', function (line) {
    var matchedCode = line.match(/[A-Z0-9]{10}/);
    var code;

    if (!matchedCode || !matchedCode[0]) {
      return;
    }

    code = matchedCode[0];
    users.forEach(function (user) {
      var matchedData;
      var occurrence;
      var hostIp;
      var email;

      if (user.codes.indexOf(code) === -1) {
        return;
      }

      matchedData = line.match(postfixDataRegex);

      if (!matchedData) {
        console.log('error: ', line);
        return;
      }

      occurrence = getOccurrence(code, matchedData, user);

      switch (matchedData[2]) {
        case 'smtpd':
          hostIp = line.match(hostIpRegex);

          if( hostIp ) {
            //occurrence.ip.push(hostIp[1] + ' - ' + hostIp[2]);
            occurrence.ip.push(hostIp[2]);
          }
          break;

        case 'qmgr':
          email = line.match(emailFromRegex);

          if (email && email[1]) {
            occurrence.from.push( email[1] );
          } else if (line.indexOf('removed') === -1) {
            console.log('************** email FROM not found: ', line);
          }

        break;

        case 'pipe':
          email = line.match(emailToRegex);
          if (email && email[1]) {
            occurrence.to.push(email[1]);
          } else {
            console.log('************** email TO not found: ', line);
          }
          break;

        default: break;
      }
    });
  });


  lineReader.on('close', function () {
    ordenar();
    printResult();
    process.exit(0);
  });


  function getOccurrence(code, matchedData, user) {
    var occurrence = null;

    user.occurrences.some(function (oc) {
      if (oc.code === code) {
        occurrence = oc;
        return true;
      }
      return false;
    });

    if (!occurrence) {
      occurrence = {
        code: code,
        date: matchedData[1],
        // module: matchedData[2],
        pid: matchedData[3],
        from: [],
        to: [],
        ip: []
      };

      user.occurrences.push(occurrence);
    }
    return occurrence;
  }
}


// ///////////////////////////


function ordenar() {
  users.sort(function (a, b) {
    if (a.count > b.count) {
      return -1;
    }

    if (a.count < b.count) {
      return 1;
    }

    return 0;
  });
}


function printResult() {
  users.forEach(function (user) {
    var ips = [];
    var froms = [];
    var tos = [];
    var codes = [];

    console.log('=====================================\n');
    console.log(user.count, user.name);

    user.occurrences.forEach(function (oc) {
      if (codes.indexOf(oc.code) === -1) {
        codes.push(oc.code);
      }

      oc.from.forEach(function (email) {
        if (froms.indexOf(email) === -1) {
          froms.push(email);
        }
      });

      oc.to.forEach(function (email) {
        if (tos.indexOf(email) === -1) {
          tos.push(email);
        }
      });

      oc.ip.forEach(function (ip) {
        if (ips.indexOf(ip) === -1) {
          ips.push(ip);
        }
      });
    });

    console.log( '\n ** FROM:\n   ', froms.join('\n    ') );
    console.log( '\n ** IPs:\n   ', ips.join('\n    ') );
    console.log( '\n ** TO:', tos.length, '\n   ', tos.join('\n    ') );
    console.log('\n\n\n\n');
  });
}
