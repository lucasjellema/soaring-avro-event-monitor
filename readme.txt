This node application cannot be run on Windows - because of challenges with npm install for kafka-avro.
Instead, the application runs in a Docker container.

Steps to run:

- run Docker Quickstart Terminal 
- cd the Docker Terminal to the current directory
- build the docker image soaring-avro-event-monitor from the latest local sources
- run the docker image as a container

cd /c/data/2018-soaring-avro-event-monitor

docker build -t soaring-avro-event-monitor .

docker run -p 8099:8099 --rm -it soaring-avro-event-monitor 

Note: if nothing has changed in package.json, rebuilding the container with the latest code changes takes just a few seconds: the previously created image layers will simply be reapplied.

When running, the container exposes port 8099

http://192.168.99.100:8099/about


