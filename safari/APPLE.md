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
identifier. 

Additionally, you may need to select a developer account to install this on your own device(s).

# Release Notes

In order to release a new RECAP Uploader version for Safari, the following tweaks are needed on each Xcode project (iOS and MacOS):


- Select "Recap" in the project sidebar, then go to TARGETS and select "Recap", go to the General panel and change the following:
 App Category: "Productivity"
 Display Name: "RECAP Uploader"
 Version: Set the current extension version in manifest.json

- Go to Signing & Capabilities panel, select a Team, and then change the bundler identifier to: free.law.recap

Repeat the process now by selecting "Recap Extension" under TARGETS, in the General panel change:
- Display Name: "RECAP Uploader Extension"
- Bundler Identifier: free.law.recap.Extension
- Version: Set the current extension version in manifest.json

Go to Signing & Capabilities panel, select a Team, and then change the bundler identifier to: free.law.recap.Extension

In order to avoid the "Missing Compliance" status when submiting a build to the App Store Connect,
is neccesary to add the following key in the info.plist:

- Go to the file "Recap/Recap/Info.plist", right click -> Add row, search and select: App Uses Non-Exempt Encryption and set its value to NO

After these changes are done, you should create a build to submit:

If you're in the iOS project first you need to select "Any iOS Device" in the project bar, then click on the "Product" menu and click "Archive". 

After the build is done, the Archives window appears:
- Select the Archive and click on "Distribute App"
- Select App Store Connect and Next
- Select Upload and Next
- Keep the following options checked and Next
- Select Automatically managing signing and Next
- Finally click on the Upload button.


Then in App Store Connect:

- Select RECAP Uploader 
- Create a new version for iOS and MacOS clicking the + and set a version target.
- Update the release information like features, version and screenshots.
- Select the build uploaded in previous steps.
- Request a Review.