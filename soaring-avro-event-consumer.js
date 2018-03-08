var KafkaAvro = require('kafka-avro');
var fmt = require('bunyan-format');
var kafkaLog = KafkaAvro.getLogger();

console.log("Consumer Products.js")
var EVENT_HUB_PUBLIC_IP = process.env.EVENT_HUB_HOST || '129.150.77.116';
var SCHEMA_REGISTRY = process.env.SCHEMA_REGISTRY || 'http://129.150.114.134:8081'

console.log("Env Setting EVENT_HUB_HOST: " + process.env.EVENT_HUB_HOST)
console.log("Env Setting SCHEMA_REGISTRY: " + SCHEMA_REGISTRY)


var kafkaAvro = new KafkaAvro({
    kafkaBroker: EVENT_HUB_PUBLIC_IP+':6667',
    schemaRegistry: SCHEMA_REGISTRY,
    parseOptions: { wrapUnions: true }
});

kafkaAvro.init()
    .then(function () {
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
    'group.id': 'avro-event-monitor' + new Date(),
    'socket.keepalive.enable': true,
    'enable.auto.commit': true,
})
    // the "getConsumer()" method will return a bluebird promise.
    .then(function (consumer) {
        console.log("create consumer")
        // Topic Name can be a string, or an array of strings

        var topicName = ['a516817-soaring-products', 'a516817-soaring-user-sign-ins', 'a516817-soaring-add-to-shopping-cart'
        , 'a516817-soaring-order-created', 'a516817-soaring-customers', 'a516817-soaring-payment-status', 'a516817-soaring-customer-status'];
        console.log("Listening to topics " + topicName)
        var stream = consumer.getReadStream(topicName, {
            waitInterval: 0
        });

        stream.on('error', function () {
            process.exit(1);
        });

        consumer.on('error', function (err) {
            console.log(err);
            process.exit(1);
        });

        stream.on('data', function (message) {
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
    console.log("event subscription received")
    subscribers.push(callback);
}
