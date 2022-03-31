#!/bin/bash -xe

cd "$(dirname "$0")"
cd ..
mkdir -p build
cd build

# clone Unirep monorepo
UNIREP="Unirep/"
if [ -d "$UNIREP" ]; then
    echo "Skip git clone unirep repository"
else
    git clone https://github.com/Unirep/Unirep.git
fi
cd Unirep
git reset 33b917bfbe796a5001ef9b039205e57daaf37d47 --hard
yarn install && yarn build
cd packages

# link all packages
for directory in *
do
    cd ${directory}
    yarn link
    cd ../../../..
    yarn link "@unirep/${directory}"
    cd build/Unirep/packages
done