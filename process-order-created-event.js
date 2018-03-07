var request = require("request");

console.log("Handle Order Created Event")
var LOGISTICS_MS_API_ENDPOINT = process.env.LOGISTICS_MS_API_ENDPOINT || 'https://oc-144-21-82-92.compute.oraclecloud.com:9129/api/logistics';

var orderCreatedEventProcessor = module.exports;

orderCreatedEventProcessor.handleProductEventHubEvent = async function (message) {
    console.log("Process Order Created:  Order Created Event payload " + JSON.stringify(message));
    var event = {
        "eventType": "OrderCreatedEvent",
        "payload": {
            "orderId": message.orderId,
            "shoppingCartId": message.shoppingCartId,
            "status": message.success,
            "totalPrice": message.totalPrice,
            "currency": message.currency,
            "payment": !message.payment ? null : {
                "cardType": message.payment.cardType,
                "cardNumber": message.payment.cardNumber ? message.payment.cardNumber.string : null,
                "startYear": message.payment.startYear ? message.payment.startYear.int : null,
                "startMonth": message.payment.startMonth ? message.payment.startMonth.int : null,
                "expiryYear": message.payment.expiryYear ? message.payment.expiryYear.int : null,
                "expiryMonth": message.payment.expiryMonth ? message.payment.expiryMonth.int : null
            },
            "customer": !message.customer ? null : {
                "customerId": message.customer.customerId ? message.customer.customerId.string : null,
                "firstName": message.customer.firstName ? message.customer.firstName.string : null,
                "lastName": message.customer.lastName ? message.customer.lastName.string : null,
                "phone": message.customer.phone ? message.customer.phone.string : null,
                "email": message.customer.email ? message.customer.email.string : null
            }
            , "addresses": (!message.addresses || !message.addresses.array) ? null
                : message.addresses.array.reduce((orderAddresses, address) => {
                    var orderAddress = { "type": address.name.string, "city": address.city.string, "country": address.country.string }
                    orderAddresses.push(orderAddress); return orderAddresses
                }
                    , []),
            "items": (!message.items || !message.items.array) ? null
                : message.items.array.reduce((orderItems, item) => {
                    var orderItem = {
                        "productId": item.productId.string, "productCode": item.productCode.string
                        , "productName": item.productName.string, "quantity": item.quantity.int
                    }
                    orderItems.push(orderItem); return orderItems
                }
                    , [])
        }
        ,
        "module": "orders.microservice",
        "transactionIdentifier": message.orderId,
        "timestamp": message.updatedAt
    }
    console.log("Handle order, event =  " + JSON.stringify(event))
    //TODO invoke Logistics API to create shipping for order

    //note:
    // to resolved an issue with the certificate (unable to verify the first certificate)
    // I added the  "rejectUnauthorized": false, based on this resource: https://stackoverflow.com/questions/31673587/error-unable-to-verify-the-first-certificate-in-nodejs
    var options = {
        method: 'POST',
        "rejectUnauthorized": false, 
                url: LOGISTICS_MS_API_ENDPOINT + '/shipping',
        headers:
            {
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json'
            },
        body:
            {
                orderIdentifier: event.payload.orderId,
                nameAddressee: event.payload.customer.firstName+" "+event.payload.customer.lastName,
                destination: { "country":event.payload.addresses[0].country,  "city" :event.payload.addresses[0].city},
                shippingMethod: 'economy',
                giftWrapping: false,
                personalMessage: null,
                items:
                    [{
                        productIdentifier: event.payload.items[0].productId,
                        itemCount: event.payload.items[0].quantity
                    }]
            },
        json: true
    };

    request(options, function (error, response, body) {
        try {
            if (error) {
                console.log("Failed to create shipping because of error " + error)

            }

            console.log("Created shipping - response from Logistics MS: " + body);
            console.log("body: " + JSON.stringify(body));
        } catch (e) {
            console.log("Failed to handle call to create shipping because of error " + e)

        }
    });

}



    // var a = {
    //     , "addresses": { "array": [{ "name": { "string": "BILLING" }, "line1": { "string": "22" }
    //, "line2": { "string": "King street" }, "city": { "string": "Leamington Spa" }
    //, "county": { "string": "Warkwickshire" }, "postcode": { "string": "CV31" }, "country": { "string": "GB" } }] }

