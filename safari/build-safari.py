import os
import plistlib
import json

src = os.path.join(os.getcwd(), "../src")
project_location = os.getcwd()
extension_plist = f"{project_location}/recap/macOS (Extension)/Info.plist"
# extension_plist = f"{project_location}/recap/recap Extension/Info.plist"
app_plist = f"{project_location}/recap/recap/Info.plist"
app_location = f"{project_location}/recap"
resources = f"{project_location}/recap/Shared (Extension)/Resources"

def update_extension_plist():
    """Set the correct URLs in extension PLIST

    :return: None
    """
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

def update_content_delegate():
    """Add safari fix.

    :return:
    """
    with open(f"{resources}/content_delegate.js", "r") as f:
        content = f.read()
    content = content.replace("(navigator.userAgent.indexOf('Chrome') < 0)", "((navigator.userAgent.indexOf('Safari') < 0 + navigator.userAgent.indexOf('Chrome')) < 0)")
    with open(f"{resources}/content_delegate.js", "w") as f:
        f.write(content)


def convert_recap_chrome_to_safari():
    """Generate XCode Project

    :return: None
    """

    with open(f"{src}/manifest.json", "rb") as f:
        version = json.load(f)["version"]

    os.system(
        f"xcrun safari-web-extension-converter {src} "
        f"--project-location {project_location} "
        f"--app-name recap "
        f"--bundle-identifier law.free.recap "
        f"--no-open "
        f"--force "
        f"--swift "
        f"--copy-resources"
    )

    # Set correct version number
    os.system(f"cd {app_location} && xcrun agvtool new-version {version}")
    os.system(f"cd {app_location} && xcrun agvtool new-marketing-version {version}")

    # Update plist for extension
    update_extension_plist()
    update_content_delegate()


if __name__ == "__main__":
    convert_recap_chrome_to_safari()
