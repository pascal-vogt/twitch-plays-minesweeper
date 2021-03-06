(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var canvas = document.getElementById('game');
    var mouseDown = false;
    var rightDown = false;
    var mmbDown = false;
    var leftDown = false;

    canvas.addEventListener('mousedown',function(event){
      mouseDown = true;
      if (event.button === 0)  leftDown = true;
      if (event.button === 1)  mmbDown = true;
      if (event.button === 2)  rightDown = true;
    });

    canvas.addEventListener('mouseup',function(event){
      if(mouseDown){
        mouseDown = false;
        if (rightDown && leftDown){
          mmbClick(event);
        } else if (event.button === 0) leftClick(event);
          else if (event.button === 1) mmbClick(event);
          else if (event.button === 2) rightClick(event);
      }
      if (event.button === 0)  leftDown = false;
      if (event.button === 1)  mmbDown = false;
      if (event.button === 2)  rightDown = false;
    });

    var ctx = canvas.getContext('2d');

    var width = canvas.width;
    var height = canvas.height;

    var gridSize = 20;
    var mineDensity = 0.2;
    var axisWidth = 20;
    var nw = Math.floor((width - 2 * axisWidth) / gridSize);
    var nh = Math.floor((height - 2 * axisWidth) / gridSize);
    document.getElementById('size-text').innerText = nw + 'x' + nh;

    var cellData = [];
    var users = [];
    var flags = 0;
    var mines = 0;
    var explodMines = 0;
    var gameStarted = true;
    var gameTime = 0;
    var gameClockInterval;
    var ws;

    function parseCoordinates(coordinateLetter, coordinateNum) {
      return {
        x: parseLetterCord(coordinateLetter),
        y: parseNumberCord(coordinateNum)
      };
    }

    function parseNumberCord(coordinate){
      return nh - 1 - parseInt(coordinate, 10);
    }

    function parseLetterCord(coordinate){
      return lettersToNumber(coordinate);
    }

    var AMOUNT_OF_LETTERS = 26;

    function lettersToNumber(letterCoordinate) {
      var i, l, code, result;
      var amountOfLetters = 1;
      var combinationsFor1ToNMinusOneLetters = 0;
      var combinationsForNLetter = AMOUNT_OF_LETTERS;
      for (i = 1, l = letterCoordinate.length; i < l; ++i) {
        ++amountOfLetters;
        combinationsFor1ToNMinusOneLetters += combinationsForNLetter;
        combinationsForNLetter *= AMOUNT_OF_LETTERS;
      }
      for (i = 0, l = letterCoordinate.length, result = 0; i < l; ++i) {
        code = letterCoordinate.charCodeAt(i);
        result *= AMOUNT_OF_LETTERS;
        if (code >= 97) {
          result += (code - 97);
        } else {
          result += (code - 65);
        }
      }
      return result + combinationsFor1ToNMinusOneLetters;
    }

    function numberToLetters(number) {
      var a, b, i, charCodes;
      var amountOfLetters = 1;
      var combinationsFor1ToNMinusOneLetters = 0;
      var combinationsForNLetter = AMOUNT_OF_LETTERS;
      while (combinationsFor1ToNMinusOneLetters + combinationsForNLetter < number + 1) {
        ++amountOfLetters;
        combinationsFor1ToNMinusOneLetters += combinationsForNLetter;
        combinationsForNLetter *= AMOUNT_OF_LETTERS;
      }
      a = 0;
      b = number - combinationsFor1ToNMinusOneLetters;
      charCodes = [];
      for (i = 0; i < amountOfLetters; ++i) {
        a = b % AMOUNT_OF_LETTERS;
        b = (b - a) / AMOUNT_OF_LETTERS;
        charCodes.unshift(a + 65);
      }
      return String.fromCharCode.apply(String, charCodes);
    }

    function updateLeaderboard() {
      var contents = '';
      var leaderBoardNameList = document.getElementById('leaderboard-name-list');
      users.sort(function (lhs, rhs) {
        if (lhs.score > rhs.score) {
          return -1;
        }
        if (lhs.score < rhs.score) {
          return 1;
        }
        return 0;
      });
      for (var i = 0, l = Math.min(10, users.length); i < l; ++i) {
        var user = users[i];
        if (user.score > 0 || user.disqualified) {
          // code to have button for revive.... nested function dosen't allow right now...
          //contents += '<li style="color:' + users[i].color + ';">' + users[i].displayName + ' (' + users[i].score + (users[i].disqualified ? ', <input id="RIP" type="button" value="rip" onclick="revive(\''+users[i].userName+'\');" />' : '') + ')</li>';

          contents += '<li style="color:' + user.color + ';">' + user.displayName + ' (' + user.score + ' points' + (user.deaths > 0 ? ', ' + user.deaths + ' deaths' : '') + (user.disqualified ? ', respawning in '+user.timeout+'s' : '') + ')</li>';

        }
      }
      leaderBoardNameList.innerHTML = contents;
    }

    function locateUser(userName, createIfNotFound) {
      for (var i = 0, l = users.length; i < l; ++i) {
        if (users[i].userName === userName) {
          return users[i];
        }
      }
      if (createIfNotFound) {
        users.push({
          userName: userName,
          score: 0,
          disqualified: false,
          deaths: 0,
          timeout: 0,
          color: '#000000',
          displayName: userName
        });
        return users[users.length - 1];
      } else {
        return null;
      }
    }

    function debugRevealAll() {
      for (y = 0; y < nh; ++y) {
        for (x = 0; x < nw; ++x) {
          cellData[y][x].isUncovered = true;
        }
      }
    }

    function debugHideAll() {
      for (y = 0; y < nh; ++y) {
        for (x = 0; x < nw; ++x) {
          cellData[y][x].isUncovered = false;
        }
      }
    }

    function executeCommand(message, userTypingTheCommand) {
      var r = /^!d(?:ig)??\s+(?:(?:([a-zA-Z]+)\s*,?\s*(\d+))|(?:(\d+)\s*,?\s*([a-zA-Z]+)))\s*$/;
      var m = message.match(r);
      if (m) {
        coordinates = parseCoordinates(m[1] || m[4], m[2] || m[3]);
        uncoverTile(coordinates, userTypingTheCommand);
      }
      r = /^!f(?:lag)?\s+(?:(?:([a-zA-Z]+)\s*,?\s*(\d+))|(?:(\d+)\s*,?\s*([a-zA-Z]+)))\s*$/;
      m = message.match(r);
      if (m) {
        coordinates = parseCoordinates(m[1] || m[4], m[2] || m[3]);
        toggleFlag(coordinates, userTypingTheCommand);
      }
      r = /^!c(?:heck)?\s+(?:(?:([a-zA-Z]+)\s*,?\s*(\d+))|(?:(\d+)\s*,?\s*([a-zA-Z]+)))\s*$/;
      m = message.match(r);
      if (m) {
        coordinates = parseCoordinates(m[1] || m[4], m[2] || m[3]);
        checkNumber(coordinates, userTypingTheCommand);
      }
      r = /^!s(?:tatus)?\s*$/;
      m = message.match(r);
      if (m) {
        showStatus(userTypingTheCommand);
      }
      if (userTypingTheCommand.userName === BOT_USERNAME || userTypingTheCommand.userName === STREAMER) {
        r = /^!reset\s*$/;
        m = message.match(r);
        if (m) {
          resetGame();
        }
        r = /^!reveal\s*$/;
        m = message.match(r);
        if (m) {
          debugRevealAll();
          drawAllTheThings();
        }
        r = /^!hide\s*$/;
        m = message.match(r);
        if (m) {
          debugHideAll();
          drawAllTheThings();
        }
        r = /^!revive (\S+)\s*$/;
        m = message.match(r);
        if (m) {
          // make sure it is lower case as twitch user names are always lower case (the display name might not be)
          revive(m[1].toLowerCase());
        }
      }
    }

    function resetGame(){
      initData();
      updateLeaderboard();
      drawAllTheThings();
      sentMessageToChat("Game has been reset.");
    }

    function revive(userName){
      var toBeRevived = locateUser(userName, false);
      if (toBeRevived) {
        sentMessageToChat('Reviving ' + toBeRevived.displayName);
        toBeRevived.disqualified = false;
        toBeRevived.timeout = 0;
        updateLeaderboard();
        drawAllTheThings();
      } else {
        sentMessageToChat('User ' + userName + ' not found');
      }
    }

    function disqualifyUser(user, reason){
      if (user.disqualified) {
        user.timeout += Math.floor(AUTO_REVIVE_TIME / 2);
        /* maybe some other function to punish
          if you are already blown up and
          others get blown up by your bad flags
        */
      } else {
        user.disqualified = true;
        user.timeout = AUTO_REVIVE_TIME;
        user.deaths++;
      }
      sentMessageToChat(user.displayName + reason);
    }

    function gameClock(){
      if (gameStarted) {
        reviveTick();
        timeTick();
      }
    }

    function reviveTick(){
      for (var i = 0, l = users.length; i < l; ++i) {
        if (users[i].disqualified) {
          users[i].timeout--;
          if (users[i].timeout <= 0) {
            revive(users[i].userName);
          }
        }
      }
      updateLeaderboard();

    }

    function timeTick(){
      if (isCompleted()) {
        var timeTillReset = AUTO_GAME_RESET_TIME; // maybe there is more elegant solution

        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);
        var fireworkParticles = [];
        var gravity = 0.0000005 * height;
        var lastTime = performance.now();
        requestAnimationFrame(function winAnimation() {
          var time = performance.now();
          var elapsed = (time - lastTime);
          lastTime = time;
          if (fireworkParticles.length === 0) {
            fireworkParticles.push({
              birth: time,
              color: 'white',
              type: 0,
              x: width * 0.5,
              y: height,
              dx: width *   0.0008 * (Math.random() - 0.5),
              dy: -height * 0.0008 * (0.6 + 0.4 * Math.random()),
              ddx: 0,
              ddy: gravity
            });
          }
          for (var i = fireworkParticles.length - 1; i >= 0; --i) {
            var particle = fireworkParticles[i];
            if (time - particle.birth > 1000) {
              fireworkParticles.splice(i, 1);
              if (particle.type === 0) {
                for (var j = 9; j >= 0; --j) {
                  var angle = Math.random() * Math.PI;
                  fireworkParticles.push({
                    birth: time,
                    color: Math.random() < 0.5 ? 'red' : 'orange',
                    type: 1,
                    x: particle.x,
                    y: particle.y,
                    dx: width *   0.0005 * Math.cos(angle),
                    dy: -height * 0.0005 * Math.sin(angle),
                    ddx: 0,
                    ddy: gravity
                  })
                }
              }
              continue;
            }
            ctx.strokeStyle = particle.color;
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            particle.x += particle.dx * elapsed;
            particle.dx += particle.ddx * elapsed;
            particle.y += particle.dy * elapsed;
            particle.dy += particle.ddy * elapsed;
            ctx.lineTo(particle.x, particle.y);
            ctx.stroke();
          }

          if (timeTillReset > 0) {
            requestAnimationFrame(winAnimation);
          }
        });

        sentMessageToChat("Game has been completed in " + gameTime + " seconds.");
        if (gameClockInterval) {
          clearInterval(gameClockInterval); // don't want to get game complete message every second
          gameClockInterval = null;
        }
        // players dead will stay dead
        var resetClockInterval = setInterval(function resetClock(){
          if (timeTillReset === 0) {
            clearInterval(resetClockInterval);
            resetGame();
          } else{
            if (timeTillReset % 5 === 0) {
              sentMessageToChat("Time till reset: " + timeTillReset + " seconds.");
            }
          }
          timeTillReset--;
        }, 1000);
      } else{
        gameTime++;
        document.getElementById('game-time').innerText = formatGameTime(gameTime);
      }
    }

    function formatGameTime(gameTime) {
      var h, m, s;
      h = Math.floor(gameTime / 3600);
      m = Math.floor(gameTime / 60) % 60;
      s = gameTime % 60;
      return formatDigits(h) + ':' + formatDigits(m) + ':' + formatDigits(s);
    }

    function formatDigits(d) {
      return (d > 9 ? '' : '0') + d;
    }

    function getNeighbours(x, y) {
      var neighbours = [];
      if (x > 0) {
        if (y > 0) {
          neighbours.push(cellData[y - 1][x - 1]);
        }
        neighbours.push(cellData[y][x - 1]);
        if (y < nh - 1) {
          neighbours.push(cellData[y + 1][x - 1]);
        }
      }
      if (x < nw - 1) {
        if (y > 0) {
          neighbours.push(cellData[y - 1][x + 1]);
        }
        neighbours.push(cellData[y][x + 1]);
        if (y < nh - 1) {
          neighbours.push(cellData[y + 1][x + 1]);
        }
      }
      if (y > 0) {
        neighbours.push(cellData[y - 1][x]);
      }
      if (y < nh - 1) {
        neighbours.push(cellData[y + 1][x]);
      }
      return neighbours;
    }

    function connectChat(){
      ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443/', 'irc');

      ws.onmessage = function (message) {
        if (message !== null) {
          var parsed = parseMessage(message.data);
          if (parsed !== null) {
            if (parsed.command === "PRIVMSG") {
              console.log('Got a message ' + JSON.stringify(parsed));
              console.log('MSG: ' + parsed.message + ' from ' + parsed.username);
              var user = locateUser(parsed.username, true);
              var colorRegexMatch = parsed.tags.match(/color=(#[0-9A-Fa-f]{6});/);
              if (colorRegexMatch) {
                user.color = colorRegexMatch[1];
              }
              var displayNameRegexMatch = parsed.tags.match(/display-name=([^;]+);/);
              if (displayNameRegexMatch) {
                user.displayName = displayNameRegexMatch[1];
              }

              executeCommand(parsed.message, user);
            } else if (parsed.command === "PING") {
              ws.send("PONG :" + parsed.message);
            }
          }
        }
      };
      ws.onerror = function (message) {
        console.log('Error: ' + message);
      };
      ws.onclose = function () {
        console.log('Disconnected from the chat server.');
      };
      ws.onopen = function () {
        if (ws !== null && ws.readyState === 1) {
          console.log('Connecting and authenticating...');

          ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands twitch.tv/membership');
          ws.send('PASS ' + BOT_OAUTH_TOKEN);
          ws.send('NICK ' + BOT_USERNAME);
          ws.send('JOIN ' + CHANNEL);
        }
      };
      document.getElementById('offline-command-container').outerHTML = '';
    }

    function sentMessageToChat(message) {
      if (ws) {
        ws.send("PRIVMSG " + CHANNEL + " :" + message + '\r\n');
      } else {
        console.log(message);
      }
    }

    function parseMessage(rawMessage) {
      var parsedMessage = {
        message: null,
        tags: null,
        command: null,
        original: rawMessage,
        channel: null,
        username: null
      };

      if(rawMessage[0] === '@'){
        var tagIndex = rawMessage.indexOf(' '),
          userIndex = rawMessage.indexOf(' ', tagIndex + 1),
          commandIndex = rawMessage.indexOf(' ', userIndex + 1),
          channelIndex = rawMessage.indexOf(' ', commandIndex + 1),
          messageIndex = rawMessage.indexOf(':', channelIndex + 1);

        parsedMessage.tags = rawMessage.slice(0, tagIndex);
        parsedMessage.username = rawMessage.slice(tagIndex + 2, rawMessage.indexOf('!'));
        parsedMessage.command = rawMessage.slice(userIndex + 1, commandIndex);
        parsedMessage.channel = rawMessage.slice(commandIndex + 1, channelIndex);
        parsedMessage.message = rawMessage.slice(messageIndex + 1);
      } else if(rawMessage.startsWith("PING")) {
        parsedMessage.command = "PING";
        parsedMessage.message = rawMessage.split(":")[1];
      }

      return parsedMessage;
    }

    function initData() {
      users = [];           // clear leaderboard
      initBoard();          // make new gameboard
      updateLeaderboard();  // draw leaderboard area
      updateStatus();       // draw Mines
      if (!gameClockInterval) {
        gameClockInterval = setInterval(gameClock, 1000); // init clock
      }
    }

    function initBoard() {
      var x, y;
      cellData = [];
      gameStarted = false;
      gameTime = 0;         // game has not started
      mines = 0;            // new board no mines(yet)
      flags = 0;            // new board no flags
      explodMines = 0;      // new board no exploded mines
      for (y = 0; y < nh; ++y) {
        var cellDataLine = [];
        cellData.push(cellDataLine);
        for (x = 0; x < nw; ++x) {
          cellDataLine.push({
            x: x,
            y: y,
            isMine: Math.random() < mineDensity,
            isExploded: false,
            isUncovered: false,
            neighbouringMineCount: 0,
            isFlagged: false,
            coordinates: {x:x, y:y}
          });
        }
      }

      for (y = 0; y < nh; ++y) {
        for (x = 0; x < nw; ++x) {
          var cell = cellData[y][x];
          if (!cell.isMine) {
            continue;
          }
          mines++;
          var neighbours = getNeighbours(x, y);
          for (var i = 0, l = neighbours.length; i < l; ++i) {
            ++neighbours[i].neighbouringMineCount;
          }
        }
      }
    }

    function clearField() {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, width, height);
    }

    function showStatus(userExecutingTheCommand) {
      sentMessageToChat('Hello ' + userExecutingTheCommand.displayName + ' you are ' + (userExecutingTheCommand.disqualified ? 'dead for '+userExecutingTheCommand.timeout+' seconds' : 'alive') + ' and have ' + userExecutingTheCommand.score + ' points and ' + userExecutingTheCommand.deaths +' deaths.');
    }

    function drawGrid() {
      for (var y = 0; y < nh + 1; ++y) {
        ctx.strokeStyle = 'black';
        ctx.beginPath();
        ctx.moveTo(0, gridSize * y);
        ctx.lineTo(nw * gridSize, gridSize * y);
        ctx.stroke();
        ctx.closePath();
      }
      for (var x = 0; x < nw + 1; ++x) {
        ctx.strokeStyle = 'black';
        ctx.beginPath();
        ctx.moveTo(gridSize * x, 0);
        ctx.lineTo(gridSize * x, nh * gridSize);
        ctx.stroke();
        ctx.closePath();
      }
    }

    function drawMineAt(x, y, isExploded) {
      var mineColor = isExploded ? 'red' : 'black';
      ctx.strokeStyle = mineColor;
      ctx.fillStyle = mineColor;
      ctx.beginPath();
      ctx.arc((x + 0.5) * gridSize, (y + 0.5) * gridSize, gridSize * 0.25, 0, 2 * Math.PI, false);
      ctx.fill();
      ctx.closePath();

      ctx.beginPath();
      ctx.moveTo(gridSize * (x + 0.1), gridSize * (y + 0.5));
      ctx.lineTo(gridSize * (x + 0.9), gridSize * (y + 0.5));
      ctx.stroke();
      ctx.closePath();

      ctx.beginPath();
      ctx.moveTo(gridSize * (x + 0.5), gridSize * (y + 0.1));
      ctx.lineTo(gridSize * (x + 0.5), gridSize * (y + 0.9));
      ctx.stroke();
      ctx.closePath();

      ctx.beginPath();
      ctx.moveTo(gridSize * (x + 0.2), gridSize * (y + 0.2));
      ctx.lineTo(gridSize * (x + 0.8), gridSize * (y + 0.8));
      ctx.stroke();
      ctx.closePath();

      ctx.beginPath();
      ctx.moveTo(gridSize * (x + 0.8), gridSize * (y + 0.2));
      ctx.lineTo(gridSize * (x + 0.2), gridSize * (y + 0.8));
      ctx.stroke();
      ctx.closePath();

      ctx.fillStyle = 'white';
      ctx.fillRect(gridSize * (x + 0.5) - 3, gridSize * (y + 0.5) - 3, 2, 2);
    }

    function drawCoveredCellAt(x, y) {
      ctx.fillStyle = 'rgb(128, 128, 128)';
      ctx.beginPath();
      ctx.moveTo(gridSize * (x + 1), gridSize * y);
      ctx.lineTo(gridSize * x + 1, gridSize * (y + 1));
      ctx.lineTo(gridSize * (x + 1), gridSize * (y + 1));
      ctx.fill();
      ctx.closePath();

      ctx.fillStyle = 'rgb(240, 240, 240)';
      ctx.beginPath();
      ctx.moveTo(gridSize * (x + 1), gridSize * y);
      ctx.lineTo(gridSize * x, gridSize * (y + 1));
      ctx.lineTo(gridSize * x, gridSize * y);
      ctx.fill();
      ctx.closePath();

      ctx.fillStyle = 'rgb(200, 200, 200)';
      ctx.fillRect(gridSize * x + 3, gridSize * y + 3, gridSize - 6, gridSize - 6);
    }

    function drawNeighbourCountAt(x, y, count) {
      if (count) {
        switch (count) {
          case 1:
            ctx.fillStyle = 'blue';
            break;
          case 2:
            ctx.fillStyle = 'green';
            break;
          case 3:
            ctx.fillStyle = 'red';
            break;
          case 4:
            ctx.fillStyle = 'rgb(0,0,100)';
            break;
          case 5:
            ctx.fillStyle = 'rgb(100,0,0)';
            break;
          case 6:
            ctx.fillStyle = 'turquoise';
            break;
          case 7:
            ctx.fillStyle = 'purple';
            break;
          default:
            ctx.fillStyle = 'black';
            break;
        }
        ctx.textAlign = 'center';
        ctx.font = "16px Arial";
        ctx.fillText(count, gridSize * (x + 0.5), gridSize * (y + 0.5));
      }
    }

    function drawFlagAt(x, y) {
      ctx.strokeStyle = 'black';
      ctx.beginPath();
      ctx.moveTo(gridSize * (x + 0.3), gridSize * (y + 0.75));
      ctx.lineTo(gridSize * (x + 0.7), gridSize * (y + 0.75));
      ctx.moveTo(gridSize * (x + 0.5), gridSize * (y + 0.75));
      ctx.lineTo(gridSize * (x + 0.5), gridSize * (y + 0.6));
      ctx.stroke();
      ctx.closePath();

      ctx.fillStyle = 'red';
      ctx.beginPath();
      ctx.moveTo(gridSize * (x + 0.5), gridSize * (y + 0.6));
      ctx.lineTo(gridSize * (x + 0.5), gridSize * (y + 0.2));
      ctx.lineTo(gridSize * (x + 0.3), gridSize * (y + 0.4));
      ctx.fill();
      ctx.closePath();
    }

    function drawAllTheThings() {
      clearField();

      drawAxis();

      ctx.save();
      ctx.transform(1, 0,  0, 1, axisWidth, axisWidth);
      drawGrid();

      for (var y = 0; y < nh; ++y) {
        for (var x = 0; x < nw; ++x) {
          var cell = cellData[y][x];
          if (!cell.isUncovered) {
            drawCoveredCellAt(x, y);
            if (cell.isFlagged) {
              drawFlagAt(x, y);
            }
          } else if (cell.isMine) {
            drawMineAt(x, y, cell.isExploded);
          } else {
            drawNeighbourCountAt(x, y, cell.neighbouringMineCount);
          }
        }
      }
      ctx.restore();
    }

    function drawAxis() {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = "11px LM Mono 12";
      ctx.strokeStyle = 'black';
      ctx.save();
      ctx.transform(1, 0, 0, 1, axisWidth, 0);
      for (var x = 0; x < nw; ++x) {
        ctx.beginPath();
        ctx.moveTo(gridSize * (x + 0.5), axisWidth * 0.8);
        ctx.lineTo(gridSize * (x + 0.5), axisWidth);
        ctx.stroke();
        ctx.closePath();
        ctx.strokeText(numberToLetters(x), gridSize * (x + 0.5), axisWidth * 0.4);

        ctx.beginPath();
        ctx.moveTo(gridSize * (x + 0.5), (nh + 1) * gridSize);
        ctx.lineTo(gridSize * (x + 0.5), (nh + 1) * gridSize + axisWidth * 0.2);
        ctx.stroke();
        ctx.closePath();
        ctx.strokeText(numberToLetters(x), gridSize * (x + 0.5), (nh + 1) * gridSize + axisWidth * 0.6);
      }
      ctx.restore();
      ctx.save();
      ctx.transform(1, 0, 0, 1, 0, axisWidth);
      for (var y = 0; y < nh; ++y) {
        ctx.beginPath();
        ctx.moveTo(axisWidth * 0.8, gridSize * (y + 0.5));
        ctx.lineTo(axisWidth, gridSize * (y + 0.5));
        ctx.stroke();
        ctx.closePath();
        ctx.strokeText((nh - 1 - y), axisWidth * 0.4, gridSize * (y + 0.5));

        ctx.beginPath();
        ctx.moveTo((nw + 1) * gridSize, gridSize * (y + 0.5));
        ctx.lineTo((nw + 1) * gridSize + axisWidth * 0.2, gridSize * (y + 0.5));
        ctx.stroke();
        ctx.closePath();
        ctx.strokeText((nh - 1 - y), (nw + 1) * gridSize + axisWidth * 0.6, gridSize * (y + 0.5));

      }
      ctx.restore();
    }

    function leftClick(event) {
      uncoverTile(mouseEventToCoordinates(event), locateUser(STREAMER, true));
    }

    function mmbClick(event) {
      checkNumber(mouseEventToCoordinates(event), locateUser(STREAMER, true));
    }

    function rightClick(event) {
      toggleFlag(mouseEventToCoordinates(event), locateUser(STREAMER, true));
    }

    function mouseEventToCoordinates(event){
      var mouseX = event.clientX - canvas.offsetLeft - axisWidth;
      var mouseY = event.clientY - canvas.offsetTop - axisWidth;
      return {
        x: Math.floor(mouseX / gridSize),
        y: Math.floor(mouseY / gridSize)
      };
    }

    function uncoverTile(coordinates, user) {
      var cell = cellData[coordinates.y][coordinates.x];
      if (user.disqualified || cell.isUncovered) {
        return;
      }
      removeFlag(cell.coordinates,false);
      if (cell.isMine) {
        if (!gameStarted) {   // if game not started, mine wont kill
          initBoard();      // new board generated
          uncoverTile(coordinates.x, coordinates.y, user);  // new dig in same locatin
          return;
        }
        blowMineUp(cell.coordinates);
        disqualifyUser(user,' just hit a mine.');
      } else if (cell.neighbouringMineCount === 0) {
        cell.isUncovered = true;
        var cellCount = expandZeroedArea(coordinates);
        user.score += (cellCount + 1);
      } else if (!cell.isUncovered) {
        cell.isUncovered = true;
        user.score += 1;
      }
      gameStarted = true; // seting game started
      updateLeaderboard();
      drawAllTheThings();
    }

    function checkNumber(coordinates, user) {
      var otherCell, i, l, hitAMine = false;
      var cell = cellData[coordinates.y][coordinates.x];
      if (user.disqualified || !cell.isUncovered) {
        return;
      }
      var neighbours = getNeighbours(coordinates.x, coordinates.y);

      // count neighbouring flags + blown up mines
      var count = 0;
      for (i = 0, l = neighbours.length; i < l; ++i) {
        otherCell = neighbours[i];
        if ((otherCell.isMine && otherCell.isUncovered) || otherCell.isFlagged) {
          count += 1;
        }
      }

      // if the count on the cell matches what the user can see (flags + blown up mines)
      if (count === cell.neighbouringMineCount) {
        for (i = 0, l = neighbours.length; i < l; ++i) {
          otherCell = neighbours[i];
          if (!otherCell.isUncovered && !otherCell.isFlagged) {
            otherCell.isUncovered = true;
            if (otherCell.isMine) {
              blowMineUp(otherCell.coordinates);
              hitAMine = true;
            } else if (otherCell.neighbouringMineCount === 0) {
              otherCell.isUncovered = true;
              removeFlag(otherCell.coordinates,true);
              var cellCount = expandZeroedArea(otherCell.coordinates);
              user.score += cellCount;
            } else {
              user.score += 1;
            }
          }
        }
        if (hitAMine) {
          sentMessageToChat(user.displayName + ' just hit a mine. Somebody placed a bad flag.');
        }
        // removing all flags, because there are bad flags
        for (i = 0, l = neighbours.length; i < l; ++i) {
          otherCell = neighbours[i];
          if (otherCell.isFlagged){
            if (otherCell.isMine && !otherCell.isUncovered) {
              otherCell.isUncovered = true;
              locateUser(otherCell.flagBy, false).score++;
            } else {
              removeFlag(otherCell.coordinates,true);
            }
          }
        }
      }
      updateLeaderboard();
      drawAllTheThings();
    }

    function toggleFlag(coordinates, user) {
      var cell = cellData[coordinates.y][coordinates.x];
      if (user.disqualified || cell.isUncovered) {
        return;
      }
      if (!cell.isUncovered && gameStarted) { // flags only on uncovered tiles and only if game has started
        if (cell.isFlagged) {
          cell.isFlagged = false;
          delete cell.flagBy;
          flags--;
        } else {
          cell.isFlagged = true;
          cell.flagBy = user.userName;
          flags++;
        }
        updateStatus();
        drawAllTheThings();
      }
    }

    function removeFlag(coordinates, disqualify){
      var cell = cellData[coordinates.y][coordinates.x];
      if (!cell.isUncovered && cell.isFlagged) {
        flags--;
        updateStatus();
        if (disqualify) disqualifyUser(locateUser(cell.flagBy, false)," got punished for bad flag.");
        delete cell.flagBy;
        cell.isFlagged = false;
        drawAllTheThings();
      }
    }

    function blowMineUp(coordinates){
      var cell = cellData[coordinates.y][coordinates.x];
      cell.isUncovered = true;
      cell.isExploded = true;
      explodMines++;
      updateStatus();
    }

    function updateStatus(){
      document.getElementById('flags').innerHTML = flags;
      document.getElementById('explodMines').innerHTML = explodMines;
      document.getElementById('mines').innerHTML = mines - (flags + explodMines);
      document.getElementById('game-time').innerText = formatGameTime(gameTime);
    }

    function isCompleted(){
      // also is triggered by debug command !reveal
      for (y = 0; y < nh; ++y) {
        for (x = 0; x < nw; ++x) {
          if (!(cellData[y][x].isUncovered || cellData[y][x].isMine)){
            return false;
          }
        }
      }
      return true;
    }

    function expandZeroedArea(coordinates){
      var count = 0;
      var cell;
      var listA = [
        cellData[coordinates.y][coordinates.x]
      ];
      var listB;
      while (listA.length) {
        listB = [];
        for (var i = 0, l = listA.length; i < l; ++i) {
          cell = listA[i];
          var neighbours = getNeighbours(cell.x, cell.y);
          for (var j = 0, m = neighbours.length; j < m; ++j) {
            cell = neighbours[j];
            if (!cell.isUncovered && cell.neighbouringMineCount === 0) {
              listB.push(cell);
            }
            if (!cell.isUncovered) {
              ++count;
              if (cell.isFlagged) {
                removeFlag(cell.coordinates,true);
              }
              cell.isUncovered = true;
            }
          }
        }
        listA = listB;
      }

      return count;
    }

    if (CONNECT_TO_CHAT) {
      connectChat();
    }else {
      document.getElementById('offline-command-field').addEventListener('keydown', function (ev) {
        if (ev.keyCode === 13) {
          // the newline at the end is what we get from twitch chat too so we are better off
          // having a realistic imitation here to avoid discovering bugs in regexes later on
          executeCommand(ev.target.value + '\r\n', locateUser(STREAMER, true));
        }
      });
    }

    initData();
    drawAllTheThings();
  });
})();
