This modules requires the expat library. You may download installation files from:
http://sourceforge.net/projects/expat/files/expat_win32/

The provided script (node-gyp.bat) requires two environment variables in order to run properly:
NODE_ROOT: Points to the root of the Node's git repo. Download node from git (https://github.com/joyent/node) and build it using the vcbuild.bat script.
EXPAT_ROOT: The root installation folder of EXPAT so that the script can locate %EXPAT_ROOT%\Source\lib\expat.h.

To generate a visual studio 2010 project run
node-gyp.bat
If you want to generate the project and build it at once do:
node-gyp.bat make

 