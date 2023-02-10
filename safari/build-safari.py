import glob
import json
import os
import plistlib
import sys
import shutil

def update_extension_plist(operating_system: str):
    """Set the correct URLs in extension plist

    Apple requires plist level updates to extensions. This took a while to figure out.

    :param operating_system: The OS to update the plist for
    :return: None
    """
    with open(f"{operating_system}/Recap!/Recap! Extension/Info.plist", "rb") as f:
        p = plistlib.loads(f.read())
    p["NSExtension"]["SFSafariPageProperties"] = {
        "Level": "Some",
        "Allowed Domains": [
            "ecf.*",
            "ecf-train.*",
            "pacer.*",
            "*.uscourts.gov",
        ],
    }
    with open(f"{operating_system}/Recap!/Recap! Extension/Info.plist", "wb") as f:
        plistlib.dump(p, fp=f)


def update_manifest_files(operating_system: str) -> None:
    """Update the manifest files for iOS and macOS.

    :param operating_system: The OS to update the manifest for
    :return: None
    """
    with open(f"{os.getcwd()}/../src/manifest.json", "rb") as f:
        manifest = json.load(f)

    #This runs XC (Xcode) commandline tool to automate the build and versions numbers.
    os.system(
        f"cd {operating_system}/Recap! && xcrun agvtool new-version {manifest['version']}"
    )
    os.system(
        f"cd {operating_system}/Recap! && xcrun agvtool new-marketing-version {manifest['version']}"
    )

    manifest["permissions"] = [
        "*://*.uscourts.gov/",
        "notifications",
        "storage",
        "unlimitedStorage",
        "activeTab",
        "cookies",
    ]
    # The main difference between iOS and macOS is the permissions.
    if operating_system == "iOS":
        manifest["background"]["persistent"] = False

    with open(
        f"{operating_system}/Recap!/Recap! Extension/Resources/manifest.json", "w"
    ) as f:
        json.dump(manifest, f, indent=2)


def update_css_and_macOS_html(operating_system: str) -> None:
    """Replace the CSS file and fix the generated HTML file.

    :param operating_system: the OS to update the CSS for.
    :return: None
    """
    if operating_system == "iOS":
        src = f"iOS/Recap!/Recap! Extension/Resources/assets/css/style-ios.css"
        dst = f"iOS/Recap!/Recap! Extension/Resources/assets/css/style.css"
        os.rename(src, dst)

    if operating_system == "macOS":
        src = f"resources/recap-macOS.html"
        dst = f"macOS/Recap!/Recap!/Base.lproj/Main.html"
        shutil.copyfile(src, dst)


def update_js_files(operating_system: str):
    """ Wrap JS files into a function to avoid being called multiple times. 

    Safari injects JS files multiple times generating variables being duplicated
    so this method wraps the indicated JS files in a method that avoid being 
    executed multiple times.

    :param operating_system: The OS to update the plist for
    :return: None
    """
    
    if operating_system == "iOS":
        path = "iOS/Recap!/Recap! Extension/Resources/assets/js/bootstrap.bundle.js"
    
    if operating_system == "macOS":
        path = "macOS/Recap!/Recap! Extension/Resources/assets/js/bootstrap.bundle.js"

    for file in glob.glob(path):
        with open(file, 'r+') as f:
            lines = f.readlines()
            f.seek(0)
            line1 = "if (typeof injectedYet === 'undefined') { \n"
            line2 = "// the script has not been injected, so we can run it  \n"
            line3 = "var injectedYet = 1; \n\n"
            f.writelines([line1, line2, line3])
            for line in lines:
                f.write(line)
            line4 = "\n}"
            f.writelines([line4])
            f.close()


def convert_recap_chrome_to_safari(operating_system: str) -> None:
    """Generate an iOS and macOS version of the extension.

    :param operating_system: The OS to generate the extension for.
    :return: None
    """
    if operating_system == "macOS":
        os_flag = "--macos-only"
    else:
        os_flag = "--ios-only"

    # Convert extension to iOS, macOS using apples xcrun safari-web-extension-converter
    os.system(
        f"xcrun safari-web-extension-converter {os.getcwd()}/../src/ "
        f"--project-location {operating_system}/ "
        f"--app-name Recap! "
        f"--bundle-identifier free.law.recap "
        f"--no-open "
        f"--force "
        f"--swift "
        f"--copy-resources "
        f"{os_flag}"
    )

    # Update plist for each OS
    update_extension_plist(operating_system)

    # Update manifest files for each OS
    update_manifest_files(operating_system)

    # Update CSS for iOS
    update_css_and_macOS_html(operating_system)

    # Update JS files for each OS
    update_js_files(operating_system)


if __name__ == "__main__":
    if sys.platform != "darwin":
        raise Exception("This script can only be run on macOS.")

    for oper_sys in ["macOS", "iOS"]:
        convert_recap_chrome_to_safari(oper_sys)
