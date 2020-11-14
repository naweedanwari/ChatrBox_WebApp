var app = require('express')();
var express = require('express');
var path = require('path');
var http = require('http').createServer(app);
var io = require('socket.io')(http);

var messages = []
var onlineUsers = [];
var emojiMap = {
  ':o': '😲',
  "<3": "\u2764\uFE0F",
  ":D": "\uD83D\uDE00",
  ":)": '😁',
  ";)": "\uD83D\uDE09",
  ":(": "\uD83D\uDE12",
  ":'(": "\uD83D\uDE22"
};

// This allows us to use the style.css file, and other assests from the current
// directory, "/"
app.use(express.static(path.join(__dirname, '/')));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// on connection do this
io.on('connection', (socket) => {
  var chosenColor = "";
  var SESSION_username = "NULL";
  console.log('a user connected');
  socket.emit("check cookie", onlineUsers);

  socket.on('checked cookie', (msg) => {
    SESSION_username = msg;
    onlineUsers.push(SESSION_username);

    // print the history of the chat to only this client
    var temp = [];
    for(var i = messages.length - 1; i > -1; i--){
      temp [0] = "NULL";
      if(messages[i].split("@")[1].includes(SESSION_username)){
        temp[0] = " class=\"self\"";
      }
      temp[1] = messages[i];
      socket.emit('chat message', temp);
    }

    // empty the users list then refil it with the valid online users
    io.emit('empty users list', "");
    io.emit('update users list', onlineUsers);

    // tell him which client he is
    temp[0] = "NULL";
    temp[1] = "Welcome to ChatrBox, You are " + SESSION_username;
    socket.emit('chat message', temp);
  });

  // on disconnect (after a connect) do this
  socket.on('disconnect', () => {
    onlineUsers = onlineUsers.filter(e => e !== SESSION_username);
    console.log('user disconnected');
    // empty the users list then refil it with the valid online users
    socket.broadcast.emit('empty users list', "");
    socket.broadcast.emit('update users list', onlineUsers);
  });

  // on 'chat message' do this
  socket.on('chat message', (msg) => {
    // replace emoticons with corresponding emojis
    for(var emoji in emojiMap){
      // escape whitespace characters so the emojis don't mess them up
      var regex = new RegExp(emoji.replace(/([()[{*+.$^\\|?])/g, '\\$1'), 'gim');
      msg = msg.replace(regex, emojiMap[emoji]);
    }

    var date = new Date();
    var timestamp = date.getHours() + ":" + date.getMinutes();
    var fullMessage = timestamp  + '@' + SESSION_username + ':\t' + msg;
    // ~ character is a delimiting character
    var sending = [];
    sending[0] = "NULL"
    sending[1] =  fullMessage;

    if(chosenColor === ""){
      // emit the message to all others
      socket.broadcast.emit('chat message', sending);
      // emit the message to yourself with self id (so it's bolded)
      sending[0] = " class=\"self\"";
      socket.emit('chat message', sending);
    }else{
      var styledMessage = "<span" + chosenColor + ">" + SESSION_username + "</span>";
      sending[1] = sending[1].replace(SESSION_username, styledMessage);
      // emit the message to all others
      sending[0] = "NULL"
      socket.broadcast.emit('chat message', sending);
      sending[0] = " class=\"self\"";
      socket.emit('chat message', sending);
    }

    // save the message
    messages.unshift(sending[1]);
    // pop last message if messages is over capacity after adding msg
    if(messages.length === 201){
      messages.pop();
    }
  });

  // on change username
  socket.on('change username', (msg) => {
    var mes = msg.split(" ");
    var temp = [];
    if(mes.length !== 2){
      temp[0] = "NULL";
      temp[1] = "ERROR: invalid username format";
      socket.emit('chat message', temp);
    }else if(mes[1].length === 0){
      var temp = [];
      temp[0] = "NULL";
      temp[1] = "ERROR: invalid username format";
      socket.emit('chat message', temp);
    }else{
      var usernameFine = true;
      for(var i = 0; i < onlineUsers.length; i++){
        if(mes[1].trim() === onlineUsers[i]){
          usernameFine = false;
          break;
        }
      }

      if(usernameFine === true){
        onlineUsers = onlineUsers.filter(e => e !== SESSION_username);
        SESSION_username = mes[1].trim();
        onlineUsers.push(SESSION_username);

        // empty the users list then refil it with the valid online users
        // sent to every user
        io.emit('empty users list', "");
        io.emit('update users list', onlineUsers);

        temp[0] = "NULL"
        temp[1] = "Welcome to ChatrBox, You are " + SESSION_username;
        socket.emit('chat message', temp);

        // change the cookie value
        socket.emit('make cookie', SESSION_username);
      }else{
        var temp = [];
        temp[0] = "NULL";
        temp[1] = "ERROR: This username is already taken";
        socket.emit('chat message', temp);
      }
    }
  });

  // on change username color
  socket.on('change username color', (msg) => {
    var msg = msg.split(" ");
    var temp = [];
    if(msg.length !== 2){
      temp[0] = "NULL";
      temp[1] = "ERROR: invalid color format";
      socket.emit('chat message', temp);
    }else{
      var msg = msg[1].split(",");
      if(msg.length !== 3){
        temp[0] = "NULL";
        temp[1] = "ERROR: invalid color format, not enough arguements";
        socket.emit('chat message', temp);
      }else{
        if(Number.isInteger(+msg[0]) === false || Number.isInteger(+msg[1]) === false || Number.isInteger(+msg[2]) === false){
          temp[0] = "NULL";
          temp[1] = "ERROR: invalid color format, not numerical values";
          socket.emit('chat message', temp);
        }else if(parseInt(msg[0]) < 0 || parseInt(msg[0]) > 255 || parseInt(msg[1]) < 0 || parseInt(msg[1]) > 255 || parseInt(msg[2]) < 0 || parseInt(msg[2]) > 255){
          temp[0] = "NULL";
          temp[1] = "ERROR: invalid color format, out of bounds values, must be between 0 and 255";
          socket.emit('chat message', temp);
        }else{
          var oldColor = chosenColor;
          chosenColor = " style=\"color:rgb(" + parseInt(msg[0]) + "," + parseInt(msg[1]) + "," + parseInt(msg[2]) + ");\" ";
          for(var i = 0; i < messages.length; i++){
            if(oldColor !== ""){
              if(messages[i].split(":")[2].includes(SESSION_username)){
                messages[i] = messages[i].replace(oldColor, chosenColor);
              }
            }else{
              if(messages[i].split(":")[1].includes(SESSION_username)){
                var styledMessage = "<span" + chosenColor + ">" + SESSION_username + "</span>";
                messages[i] = messages[i].replace(SESSION_username, styledMessage);
              }
            }
          }
          // replace messages for everyone (wiht new updated color)
          io.emit('refresh messages', messages);
          var temp = [];
          temp[0] = "NULL";
          temp[1] = "Welcome to ChatrBox, You are " + SESSION_username;
          socket.emit('chat message', temp);
        }
      }
    }
  });
});

// listen to port 3000 of local host
http.listen(3000, () => {
  console.log('listening on *:3000');
});
