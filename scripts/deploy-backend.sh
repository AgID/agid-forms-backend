#!/bin/bash
# set -x

cd $PWD
versionStr=$(grep version package.json | head -1); 

if [[ $versionStr =~ [0-9]\.[0-9]\.[0-9] ]]; then
  version=${BASH_REMATCH[0]}
  echo "Deploying version " $version
else 
  echo "no version found in package.json"; 
  exit 10
fi

docker build -t gunzip/agid-forms-backend:$version .

docker push gunzip/agid-forms-backend:$version

# kubectl apply -f ./k8s/backend.yml
