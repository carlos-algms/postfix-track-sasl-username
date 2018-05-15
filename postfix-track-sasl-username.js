const { createInterface } = require('readline');
const { createReadStream } = require('fs');

const targetFile = process.argv[2] || 'mail.log';
const FILE_PATH = `/var/log/${targetFile}`;
const users = [];
const findUsersLineReader = createInterface({ input: createReadStream(FILE_PATH) });

console.info('File path: ', FILE_PATH);

findUsersLineReader.on('line', (line) => {
  const saslUsername = line.match(/sasl_username=(.*)/);

  if (!saslUsername) {
    return;
  }

  const user = getUser(saslUsername[1]);
  user.count += 1;

  const code = line.match(/[A-Z0-9]{10}/);
  user.codes.push(code[0]);
});

findUsersLineReader.on('close', readOccurrences);

function getUser(username) {
  let user = users.find(currentUser => currentUser.name === username);

  if (!user) {
    user = {
      name: username,
      count: 0,
      occurrences: [],
      codes: [],
      ips: [],
      froms: [],
      tos: [],
    };

    users.push(user);
  }

  return user;
}


// //////////////////////////////////


function readOccurrences() {
  const postfixDataRegex = /([a-z]{2}\s+\d{1,2} \d{2}:\d{2}:\d{2}) .* postfix\/(.*)\[(\d+)\]/i;
  const hostIpRegex = /client=(.*?)\[([0-9.]+)\]/i;
  const emailToRegex = /to=<(.*?)>/i;
  const emailFromRegex = /from=<(.*?)>/i;

  const lineReader = createInterface({ input: createReadStream(FILE_PATH) });

  lineReader.on('line', (line) => {
    const matchedCode = line.match(/[A-Z0-9]{10}/);

    if (!matchedCode || !matchedCode[0]) {
      return;
    }

    const code = matchedCode[0];
    users.forEach((user) => {
      if (user.codes.includes(code)) {
        return;
      }

      const matchedData = line.match(postfixDataRegex);

      if (!matchedData) {
        console.error('error: ', line);
        return;
      }

      const occurrence = getOccurrence(code, matchedData, user);
      const logType = matchedData[2];
      let hostIp;
      let email;

      switch (logType) {
        case 'smtpd':
          hostIp = line.match(hostIpRegex);

          if (hostIp) {
            occurrence.ip.push(hostIp[2]);
            userAddProp('ips', user, hostIp[2]);
          }
          break;

        case 'qmgr':
          email = line.match(emailFromRegex);

          if (email && email[1]) {
            occurrence.from.push(email[1]);
            userAddProp('froms', user, email[1]);
          } else if (line.indexOf('removed') === -1) {
            console.error('************** email FROM not found: ', line);
          }
          break;

        case 'pipe':
          email = line.match(emailToRegex);

          if (email && email[1]) {
            occurrence.to.push(email[1]);
            userAddProp('tos', user, email[1]);
          } else {
            console.error('************** email TO not found: ', line);
          }
          break;

        default: break;
      }
    });
  });


  lineReader.on('close', () => {
    sort();
    printResult();
    process.exit(0);
  });


  function getOccurrence(code, matchedData, user) {
    let occurrence = user.occurrences.find(oc => oc.code === code);

    if (!occurrence) {
      occurrence = {
        code,
        date: matchedData[1],
        pid: matchedData[3],
        from: [],
        to: [],
        ip: [],
      };

      user.occurrences.push(occurrence);
    }
    return occurrence;
  }
}


// ///////////////////////////


function sort() {
  users.sort((a, b) => {
    if (a.tos.length > b.tos.length) {
      return -1;
    }

    if (a.tos.length < b.tos.length) {
      return 1;
    }

    return 0;
  });
}

function userAddProp(prop, user, data) {
  if (user[prop].indexOf(data) === -1) {
    user[prop].push(data);
  }
}

function printResult() {
  users.forEach((user) => {
    console.info('=====================================\n');
    console.info(user.count, user.name);
    console.info('\n ** FROM:\n   ', user.froms.join('\n    '));
    console.info('\n ** IPs:\n   ', user.ips.join('\n    '));
    console.info('\n ** TO:', user.tos.length, '\n   ', user.tos.join('\n    '));
    console.info('\n\n\n\n');
  });
}
