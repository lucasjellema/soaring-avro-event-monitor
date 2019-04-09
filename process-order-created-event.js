var request = require("request");

console.log("Handle Order Created Event - Logistics Endpoint Env Var  " + process.env.LOGISTICS_MS_API_ENDPOINT)
var LOGISTICS_MS_API_ENDPOINT = process.env.LOGISTICS_MS_API_ENDPOINT || 'https://oc-144-21-82-92.compute.oraclecloud.com:9129/api/logistics';
var ORDERS_MS_API_ENDPOINT = process.env.ORDERS_MS_API_ENDPOINT || 'https://oc-144-21-82-92.compute.oraclecloud.com:9129/api/orders';

var orderCreatedEventProcessor = module.exports;

orderCreatedEventProcessor.handleOrderEventHubEvent = async function (message) {
    console.log("Process Order Created:  Order Created Event payload " + JSON.stringify(message));
    // only process the order if it has not been canceled
    if (message.status == "CANCELED") return;
    var event = {
        "eventType": "OrderCreatedEvent",
        "payload": {
            "orderId": message.orderId,
            "shoppingCartId": message.shoppingCartId,
            "status": message.status,
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
            "shipping": {
                "shippingMethod": (!message.shipping || !message.shipping.shippingMethod) ? null : message.shipping.shippingMethod
                , "shippingCompany": (!message.shipping || !message.shipping.shippingCompany || !message.shipping.shippingCompany.string) ? null : message.shipping.shippingCompany.string
                , "shippingId": (!message.shipping || !message.shipping.shippingId || !message.shipping.shippingId.string) ? null : message.shipping.shippingId.string
            },
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
    console.log("Compose and send request to Logistics MS API to create shipping")

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
            nameAddressee: (event.payload.shipping && event.payload.shipping.firstName) ?
                event.payload.shipping.firstName + " " + event.payload.shipping.lastName
                : event.payload.customer.firstName + " " + event.payload.customer.lastName,
            // if there is a specific delivery address, use that for the destination; if there is none, use the first address found in the order created event
            destination: event.payload.addresses.reduce((destination, address) => {
                console.log("From reduce on addresses; " + JSON.stringify(address) + "- destination " + JSON.stringify(destination))
                if (!destination || !destination.country || address.type.toUpperCase() == 'DELIVERY') {
                    console.log("define destination ")
                    destination.country = address.country, destination.city = address.city
                    console.log("defined destination " + JSON.stringify(destination))
                }
                return destination
             }
             , { "city": null, "country": null }),
            shippingMethod: event.payload.shipping && event.payload.shipping.shippingMethod ? event.payload.shipping.shippingMethod : 'economy',
            shipping: event.payload.shipping,
            giftWrapping: event.payload.specialDetails && event.payload.specialDetails.giftWrapping && event.payload.specialDetails.giftWrapping.boolean
                ? event.payload.specialDetails.giftWrapping.boolean
                : false,
            personalMessage: event.payload.specialDetails && event.payload.specialDetails.personalMessage && event.payload.specialDetails.personalMessage.string
                ? event.payload.specialDetails.personalMessage.string
                : false,
            items: event.payload.items.map(item => {
                return {
                    productIdentifier: item.productId,
                    itemCount: item.quantity
                }
            })
        },
        json: true
    };

    request(options, function (error, response, body) {
        try {
            if (error) {
                console.log("Failed to create shipping because of error " + error)

            }

            console.log("response from Logistics MS: " + body);
            console.log("body: " + JSON.stringify(body));
            if (body.status == "OK") {
                console.log("Created shipping successfully (hoorah); shipping costs have been set at :" + body.shippingCosts)
                // TODO update the order with the actual shipping costs
            }
            if (body.status == "NOK") {
                console.log("Failed to create shipping successfully (boohoo); because of :" + JSON.stringify(body.validationFindings))
                // if the failure to create the shipping as anything to do with validation failure - requesting out of stock products or an unsupported shipping destination - then the order should be canceled 
                //note:
                // to resolved an issue with the certificate (unable to verify the first certificate)
                // I added the  "rejectUnauthorized": false, based on this resource: https://stackoverflow.com/questions/31673587/error-unable-to-verify-the-first-certificate-in-nodejs
                var options = {
                    method: 'POST',
                    "rejectUnauthorized": false,

                    url: ORDERS_MS_API_ENDPOINT + "/" + event.payload.orderId + '/cancel',
                    headers:
                    {
                        'Cache-Control': 'no-cache',
                        'api-key': '73f1c312-64e1-4069-92d8-0179ac056e90',
                        'Content-Type': 'application/json'
                    },
                    body: {},
                    json: true
                };

                console.log("Inform Orders MS about canceled order ")
                console.log(JSON.stringify(options))
                request(options, function (error, response, body) {
                    if (error) throw new Error(error);

                    console.log("call to cancel order was successful");
                    console.log(body);
                });
            }

        } catch (e) {
            console.log("Failed to handle call to create shipping because of error " + e)

        }
    });

}//orderCreatedEventProcessor



    // var a = {
    //     , "addresses": { "array": [{ "name": { "string": "BILLING" }, "line1": { "string": "22" }
    //, "line2": { "string": "King street" }, "city": { "string": "Leamington Spa" }
    //, "county": { "string": "Warkwickshire" }, "postcode": { "string": "CV31" }, "country": { "string": "GB" } }] }

