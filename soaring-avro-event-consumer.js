var KafkaAvro = require('kafka-avro');
var fmt = require('bunyan-format');
var kafkaLog  = KafkaAvro.getLogger();

console.log("Consumer Products.js")

var kafkaAvro = new KafkaAvro({
    kafkaBroker: '129.150.77.116:6667',
    schemaRegistry: 'http://129.150.114.134:8081',
    parseOptions: { wrapUnions: true }
});

kafkaAvro.init()
    .then(function() {
        console.log('Ready to use');
    });


kafkaLog.addStream({
    type: 'stream',
    stream: fmt({
        outputMode: 'short',
        levelInString: true,
    }),
    level: 'debug',
});


kafkaAvro.getConsumer({
  'group.id': 'avro-event-monitor'+new Date(),
  'socket.keepalive.enable': true,
  'enable.auto.commit': true,
})
    // the "getConsumer()" method will return a bluebird promise.
    .then(function(consumer) {
        console.log("create consumer")
        // Topic Name can be a string, or an array of strings

        var topicName = ['a516817-soaring-products','a516817-soaring-user-sign-ins','a516817-soaring-add-to-shopping-cart','a516817-soaring-order-created','a516817-soaring-customers'];

        var stream = consumer.getReadStream(topicName, {
          waitInterval: 0
        });

        stream.on('error', function() {
          process.exit(1);
        });

        consumer.on('error', function(err) {
          console.log(err);
          process.exit(1);
        });

        stream.on('data', function(message) {
            console.log('Received message from topic:', message.topic);
            console.log('Received message content:', message.parsed);
            subscribers.forEach((subscriber) => {
                subscriber(message.topic, message.parsed);
        
            })
   });
    });

    
var subscribers = [];

var avroEventHubListener = module.exports;

avroEventHubListener.subscribeToEvents = function (callback) {
console.log("subscription receied")
    subscribers.push(callback);
}
