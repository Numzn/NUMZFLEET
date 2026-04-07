npm run build
scp -i ~/.ssh/oci_instance_key.pem -r dist/* ubuntu@129.151.163.95:/home/ubuntu/NUMZFLEET/traccar-fleet-system/frontend/dist/
ssh -i ~/.ssh/oci_instance_key.pem ubuntu@129.151.163.95 "docker exec numztrak-nginx nginx -s reload"npm run build
scp -i ~/.ssh/oci_instance_key.pem -r dist/* ubuntu@129.151.163.95:/home/ubuntu/NUMZFLEET/traccar-fleet-system/frontend/dist/
ssh -i ~/.ssh/oci_instance_key.pem ubuntu@129.151.163.95 "docker exec numztrak-nginx nginx -s reload"