# Network Diagram Designer

A Visio-style desktop editor for network diagrams (Python + Tkinter).

## Start
- Desktop / Start Menu shortcut **Network Diagram Designer**, or `run_app.bat`.
- First time on a new PC: `setup.bat` (installs Pillow, openpyxl, pywin32 and the shortcuts,
  and makes `.netdiag` files open in the app).

## Drawing
| Action | How |
|---|---|
| Add a device | Drag it from the **Shapes** palette onto the page (or click it to drop it in the middle) |
| Link two devices | **Ctrl+3** (Connector tool), then drag from one shape to the other. **Esc** goes back to the pointer |
| Rename | Double-click or **F2**. Shift+Enter adds a new line |
| Device details | Properties panel: IP, model, serial, location, notes, colours, font, size |
| Link details | Properties panel: link label, **From port / To port** (e.g. Gi1/0/1), straight or right-angle routing, arrows, dashes, colour, width |
| Group a site / VLAN / DMZ | **Zone / Site** shape (Basic shapes). Moving a zone moves the devices inside it |
| Select several | Shift/Ctrl+click, or drag a box on empty space |
| Resize | Drag the handles (Shift keeps the proportions) |
| Nudge | Arrow keys (grid step), Shift+arrow (1 px). Hold **Alt** while dragging to turn snapping off |
| Align / distribute | **Arrange** menu (the first shape you selected is the reference) |
| Zoom / pan | Ctrl+wheel, Ctrl+ +/-, Fit button. Wheel scrolls, Shift+wheel scrolls sideways, middle-drag pans |
| Pages | Tabs at the bottom: **+** adds a page; right-click a tab to rename, duplicate, move or delete it |

Several links between the same two devices (port-channels, redundant links) are spread apart automatically.

## Cisco icons (built in)
Two Cisco icon sets are in the palette (click a category heading to open or close it; the search box
looks inside them too):
- **Cisco 3D**: 135 icons from Cisco's PowerPoint icon library, Oct 2016 (the dark-navy "Default" style).
- **Cisco Classic**: 294 classic blue topology icons (the PMS 3015 JPG set), with the white background made transparent.

Source: https://www.cisco.com/c/en/us/about/brand-center/network-topology-icons.html. Cisco says the
icons may be used freely but not altered. To refresh them, download `icon-library-production-oct2016.zip`
and `3015_jpeg.zip` from that page, extract them (the pptx into `<work>\pptx\lib.pptx`, the JPGs into
`<work>\jpg\`), then run
`python tools\convert_cisco_icons.py <work> icons`.
The product hardware stencils on Cisco's Visio stencil page are old binary .vss files that need Visio,
so they are not included.

Any sub-folder of `icons\` shows up as its own palette category, so you can drop in other vendors' PNGs
(for example `icons\Fortinet\`).

## Your own icons
Under **Custom icons** in the palette, choose **Import icon image...** and pick PNG/JPG files (for example
the official Cisco or Fortinet icon packs). They are copied into `icons\` and stay in the palette.
Each diagram stores its own copy of the icons it uses, so the `.netdiag` file works on any PC.

## Output
- **File > Export page as PNG** (high resolution) or **SVG**.
- **File > Export all pages to PDF**.
- **Copy image** (Ctrl+Shift+C) puts the page on the clipboard so you can paste it into Word, PowerPoint or Outlook.
- **Inventory**: an Excel workbook with a *Devices* sheet (name, type, IP, model, serial, location, notes)
  and a *Links* sheet (device, port, device, port, label).

## Files
- `diagram_app.py`: the GUI (canvas, palette, properties, menus)
- `render.py`: drawing engine. The same routines draw the screen (Tk), PNG/PDF (Pillow) and SVG
- `stencils.py`: icon library. Each icon is made of simple shapes in a 0..1 box, so you can add more there
- `diagram_model.py`: file format (`.netdiag` = JSON), exports, inventory
- Settings: `%APPDATA%\Network Diagram Designer\settings.json`
