import json
import os
import plistlib
from sys import platform


def update_extension_plist(operating_system: str):
    """Set the correct URLs in extension plist

    Apple requires plist level updates to extensions. This took a while to figure out.
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


def update_manifest_files(manifest, operating_system: str) -> None:
    """Update the manifest files for iOS and macOS.

    :param manifest: The Manifest File as JSON
    :param operating_system: The OS to update the manifest for
    :return: None
    """

    # This runs XC (Xcode) commandline tool to automate the build and versions numbers.
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


def update_content_delegate(operating_system: str) -> None:
    """Update the respective content delegate files for safari.

    :return:None
    """
    content_delegate = (
        f"{operating_system}/Recap!/Recap! Extension/Resources/content_delegate.js"
    )

    with open(content_delegate, "r") as f:
        content = f.read()
    content = content.replace(
        "(navigator.userAgent.indexOf('Chrome') < 0)",
        "(navigator.userAgent.indexOf('Safari') < 0)",
    )
    with open(content_delegate, "w") as f:
        f.write(content)


def update_css() -> None:
    """Tweak the CSS to work on iOS.

    :return:None
    """
    css_filepath = f"iOS/Recap!/Recap! Extension/Resources/assets/css/style.css"
    with open(css_filepath, "r") as f:
        css = f.read()

    css = css.replace("width: 580px;", "width: 100%;")
    css = css.replace(
        """#options-body main {
  padding: 20px;
}
""",
        """#options-body main {
  padding-top: 100px;
}
""",
    )

    with open(css_filepath, "w") as f:
        f.write(css)


def convert_recap_chrome_to_safari(operating_system: str) -> None:
    """Generate an iOS and macOS version of the extension.

    :return: None
    """
    with open(f"{os.getcwd()}/../src/manifest.json", "rb") as f:
        manifest = json.load(f)

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

    # Update content delegate for each OS
    update_content_delegate(operating_system)

    # Update manifest files for each OS
    update_manifest_files(manifest, operating_system)

    if operating_system == "iOS":
        update_css()


if __name__ == "__main__":
    if platform != "darwin":
        raise Exception("This script can only be run on macOS.")

    for oper_sys in ["macOS", "iOS"]:
        convert_recap_chrome_to_safari(oper_sys)
