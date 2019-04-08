var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var http = require('http');

// local modules
var eventHubListener = require("./soaring-avro-event-consumer.js");
var orderCreatedEventProcessor = require("./process-order-created-event.js");

var model = require("./model");

var PORT = process.env.APP_PORT || 8099;
var APP_VERSION = "0.0.17"
var APP_NAME = "Soaring Avro Event Monitor MS"

var totalEventCount = 0;

var server = http.createServer(app);
server.listen(PORT, function () {
    console.log("Running " + APP_NAME + " version " + APP_VERSION + "; listening at port " + PORT);
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
//app.use(cookieParser());

app.get('/about', function (req, res) {
    var about = {
        "about": "Soaring Avro Event Consumer",
        "PORT": process.env.PORT,
        "APP_VERSION ": APP_VERSION
    }
    res.json(about);
})


app.get('/health', function (req, res) {
    var health = { "status": "OK", "uptime": process.uptime(), "version": APP_VERSION, "numberOfEventsProcessed": totalEventCount }
    res.setHeader('Content-Type', 'application/json');
    res.send(health);
});


eventHubListener.subscribeToEvents(
    (topic, message) => {
        console.log("Avro EventBridge: Received event from event hub on topic " + topic);
        totalEventCount++;
        try {
            console.log("The event:")
            console.log(JSON.stringify(message))
            handleSoaringEventHubEvent(topic, message)
            if (topic == "soaring-products" && message.productId) {
                handleProductEventHubEvent(message)
            }
            if (topic == "soaring-ordercreated" || topic == "soaring-ordercreated-2" ) {
                orderCreatedEventProcessor.handleOrderEventHubEvent(message)
            }
            if (topic == "soaring-shipmentpickedup") {
                handleShipmentPickedUp(message)
            }
            if (topic == "soaring-shipmentreceived") {
                handleShipmentDelivered(message)
            }
            
            } catch (error) {
            console.log("failed to handle message from event hub", error);

        }
    }
);

async function handleShipmentPickedUp(message) {
    console.log("External Shipper has picked up shipment Event payload " + JSON.stringify(message));
    //TODO update Shipping index for this shipping with the new status
}//handleShipmentPickedUp    

async function handleShipmentDelivered(message) {
    console.log("External Shipper has delivered shipment Event payload " + JSON.stringify(message));
    //TODO update Shipping index for this shipping with the new status
}//handleShipmentDelivered    


async function handleProductEventHubEvent(message) {
    console.log("Product Event payload " + JSON.stringify(message));
    var event = {
        "eventType": "ProductEvent",
        "payload": {
            "productIdentifier": message.productId,
            "productCode": message.productCode.string,
            "productName": message.productName.string,
            "imageUrl": message.imageUrl ? message.imageUrl.string : null,
            "price": message.price ? message.price.double : null,
            "size": message.size ? message.size.int : null,
            "weight": message.weight ? message.weight.double : null,
            "categories": message.categories,
            "tags": message.tags,
            "dimension": message.dimension ? {
                "unit": message.dimension.unit ? message.dimension.unit.string : null,
                "length": message.dimension.length ? message.dimension.length.double : null,
                "height": message.dimension.height ? message.dimension.height.double : null,
                "width": message.dimension.width ? message.dimension.width.double : null
            } : null,
            "color": message.color ? message.color.string : null

        }
        ,
        "module": "products.microservice",
        "transactionIdentifier": message.productId,
        "timestamp": getTimestampAsString()
    }
    // store event in Elastic Search Index
    var result = await model.saveProductEvent(event);

    var product =
        {
            "id": message.productId,
            "name": message.productName.string,
            "weight": message.weight ? message.weight.double : null,
            "dimension": message.dimension ? {
                "unit": message.dimension.unit ? message.dimension.unit.string : null,
                "length": message.dimension.length ? message.dimension.length.double : null,
                "height": message.dimension.height ? message.dimension.height.double : null,
                "width": message.dimension.width ? message.dimension.width.double : null
            } : null,
            "categories": message.categories
        }

    console.log("Storing product in Warehouse Product Registry")    
    // store (or update?) product  in Elastic Search Index
    result = await model.saveProduct(product);
    console.log("Debug: Storing product in Warehouse Product Registry result "+JSON.stringify(result))    
    // create stocktransaction 0 in Elastic Search Index
    console.log("Debug: Create Stock Transaction for product ")
    result = await model.saveProductStockTransaction(
        {
            "productIdentifier": message.productId
            , "quantityChange": 0
            , "category": "introduction"
            , "timestamp": getTimestampAsString()
        })

}


async function handleSoaringEventHubEvent(topic, message) {
    console.log("Event payload " + JSON.stringify(message));
    var event = {
        "eventType": topic + "Event",
        "payload": message
        ,
        "module": topic,
        "transactionIdentifier": Date.now(),
        "timestamp": getTimestampAsString(),
        "producer": "processed and recorded by "+APP_NAME+"-"+APP_VERSION
    }
    // store event in Elastic Search Index
    var result = await model.dumpSoaringEvent("soaringevents" + topic, event);
}

getTimestampAsString = function (theDate) {
    var sd = theDate ? theDate : new Date();
    try {
        var ts = sd.getUTCFullYear() + '-' + (sd.getUTCMonth() + 1) + '-' + sd.getUTCDate() + 'T' + sd.getUTCHours() + ':' + sd.getUTCMinutes() + ':' + sd.getSeconds();
        return ts;
    } catch (e) { "getTimestampAsString exception " + JSON.stringify(e) }
}

