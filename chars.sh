#!/bin/bash
while read -n1 c
do
o=`convert -size 20x15 xc: +antialias -font $1 -draw "text 0,10 '$c'" xpm:-`
o=${o//[^ ]}
a[${#o}]+=$c
done
echo "${a[@]}"