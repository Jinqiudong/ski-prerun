import UIKit
import Capacitor

// The app's web view. Same as Capacitor's, but with a router that serves a folder's own index.html: the site
// links to "mountain/?resort=…" (GitHub Pages serves mountain/index.html there), while Capacitor's default
// router answers any path without an extension with the root index.html, as for a single-page app.
class ViewController: CAPBridgeViewController {
    override open func router() -> Router {
        return SiteRouter()
    }
}

struct SiteRouter: Router {
    var basePath: String = ""

    func route(for path: String) -> String {
        if path.hasSuffix("/") {
            return basePath + path + "index.html"
        }
        // No extension and not a folder: a folder named without its slash, or the root.
        if URL(fileURLWithPath: path).pathExtension.isEmpty {
            let folder = basePath + path + "/index.html"
            return FileManager.default.fileExists(atPath: folder) ? folder : basePath + "/index.html"
        }
        return basePath + path
    }
}
