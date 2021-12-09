import json
import os
import plistlib

project_location = os.getcwd()


def update_extension_plist():
    """Set the correct URLs in extension PLIST

    :return: None
    """
    extension_plist = f"{project_location}/macOS/recap/recap Extension/Info.plist"
    with open(extension_plist, "rb") as f:
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
    with open(extension_plist, "wb") as f:
        plistlib.dump(p, fp=f)


def update_content_delegate(operating_system: str) -> None:
    """Add safari fix.

    :return:
    """
    resources = f"{project_location}/{operating_system}/recap/recap Extension/Resources"

    with open(f"{resources}/content_delegate.js", "r") as f:
        content = f.read()
    content = content.replace(
        "(navigator.userAgent.indexOf('Chrome') < 0)",
        "((navigator.userAgent.indexOf('Safari') < 0 + navigator.userAgent.indexOf('Chrome')) < 0)",
    )
    with open(f"{resources}/content_delegate.js", "w") as f:
        f.write(content)


def convert_recap_chrome_to_safari(operating_system: str) -> None:
    """Generate XCode Project

    :return: None
    """
    src = os.path.join(os.getcwd(), "../src")
    with open(f"{src}/manifest.json", "rb") as f:
        manifest = json.load(f)

    if operating_system == "macOS":
        os_flag = "--macos-only"
    else:
        os_flag = "--ios-only"

    os.system(
        f"xcrun safari-web-extension-converter {src} "
        f"--project-location {project_location}/{operating_system}/ "
        f"--app-name recap "
        f"--bundle-identifier law.free.recap "
        f"--no-open "
        f"--force "
        f"--swift "
        f"--copy-resources "
        f"{os_flag}"
    )

    # Set correct version number
    app_location = f"{project_location}/{operating_system}/recap"

    os.system(f"cd {app_location} && xcrun agvtool new-version {manifest['version']}")
    os.system(
        f"cd {app_location} && xcrun agvtool new-marketing-version {manifest['version']}"
    )

    # Update plist for extension
    if operating_system == "macOS":
        update_extension_plist()
    update_content_delegate(operating_system)

    manifest["permissions"] = [
        "*://*.uscourts.gov/",
        "notifications",
        "storage",
        "unlimitedStorage",
        "activeTab",
        "cookies",
    ]
    if operating_system == "iOS":
        manifest["background"]["persistent"] = False
    with open(
        f"{project_location}/{operating_system}/recap/recap Extension/Resources/manifest.json",
        "w",
    ) as f:
        json.dump(manifest, f, indent=2)


if __name__ == "__main__":

    for oper_sys in ["macOS", "iOS"]:
        convert_recap_chrome_to_safari(oper_sys)
