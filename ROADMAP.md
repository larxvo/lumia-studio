# Roadmap

This is a direction for development, not a list of shipped features or a delivery-date promise. The [compatibility matrix](docs/COMPATIBILITY.md) describes the current product.

| Priority | Work | Acceptance evidence |
| --- | --- | --- |
| Quality | Hair/hand/transparent-edge matting and crowded-scene removal | Licensed representative fixtures; native-resolution edge review; protected-region pixel checks and failure examples. |
| Desktop | Interactive Windows testing, crash recovery, memory/performance profiling and code signing | Recorded PC/OS configurations; install/update/removal tests; measured large-image workflows; verified publisher when credentials are available. |
| Generative AI | Physical-GPU benchmark coverage beyond a single portrait | Recorded hardware/checkpoint, repeatable runs, representative cases and manual identity/texture/seam review; no CPU substitute labeled as GPU. |
| Canva | Shared public OAuth onboarding and reviewed integration | Registered/approved application, server-side secret management and live authorized account tests. Offline native layer-tree editing remains dependent on supported platform capabilities. |
| Format engine | Broader Photoshop compatibility and higher bit-depth workflows | Golden fixtures produced by independent applications; editable round trips where supported; explicit fallback where not. |
| Color and print | Additional ICC/print workflow validation | Printer-supplied profiles, controlled test charts and documented output behavior. |
| Usability | Consistent localization, keyboard/accessibility review and clearer long-job feedback | Interaction/visual checks on the intended desktop layouts, with cancellation and undo verified. |
| Distribution | Versioned releases, reproducible asset provenance and broader support documentation | CI/release reports, source archives, checksums, maintained notices and reviewable change logs. |

The core product should remain free to use, retain original source data where supported, and avoid forced visual watermarks. Optional third-party services and user-supplied GPU compute have their own terms/costs. A future feature is not advertised as complete solely because a UI control or connector exists.
