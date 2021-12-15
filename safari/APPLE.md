##SAFARI Extension iOS, iPadOS, macOS

-----------------------------------


### Notes 

Anyone new to this should read this page.  To build the Apple extensions, you must be running
macOS 11.0.0 or higher.  You must also have Xcode 13.0.0 or higher.  You must also have the xcrun 
and Xcode tools installed.

This code is based on the [safari-extension-template](
https://developer.apple.com/documentation/safariservices/safari_web_extensions/converting_a_web_extension_for_safari
)

### Quick Start

cd into the safari directory and run the following command:

    python build-safari.py

This will create two new directories for iOS (and iPadOS) and macOS.
Each of these directories will contain a new extension and XCode project.

Once generated you can run the separate xcode projects.  You may need to tweak the bundle 
identifier, which does not like the bang(!) in the name. 

Additionally, you may need to select a developer account to install this on your own device(s).

