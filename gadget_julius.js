<!DOCTYPE html>
<head>
    <meta charset="utf-8">
	  <title>Annyang Gadget</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <script type="text/javascript" src="rsvp.js"></script>
    <script type="text/javascript" src="renderjs.js"></script>
  
    <script type="text/javascript" src="julius.js"></script>
</head>
<body>
  Say something:
  
  <div id="what-you-said"></div>
  
  Note that my vocabulary is limited for this demo.
  <script>
  var julius = new Julius({
    // log: true
  });
  
  julius.onrecognition = function(sentence) {
    console.log('Sentence: ', sentence);
    document.getElementById('what-you-said').innerHTML = sentence;
  }
  julius.onfirstpass = function(sentence) {
    console.log('First pass: ', sentence);
  }
  julius.onfail = function() {
    // This will throw its own Error
    // console.error('fail');
  }
  // This will only log if you pass `log: true` in the options object
  julius.onlog = function(log) {
    console.log(log);
  }
  </script>
</body>
</html>
