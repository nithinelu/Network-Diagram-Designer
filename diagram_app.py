"""Network Diagram Designer - a Visio-style editor for network diagrams.

Drag devices from the stencil palette, link them with connectors (Ctrl+3),
group them in zones, label interfaces and IPs, then export PNG / SVG / PDF,
copy the page to the clipboard, or export a device/link inventory to Excel.
"""
import base64
import copy
import json
import math
import os
import sys
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, simpledialog, colorchooser

import diagram_model as dm
import render
from stencils import STENCILS, CATEGORIES

APP_NAME = "Network Diagram Designer"
FILE_EXT = ".netdiag"
HERE = os.path.dirname(os.path.abspath(__file__))
ICON_DIR = os.path.join(HERE, "icons")
SETTINGS_DIR = os.path.join(os.environ.get("APPDATA", HERE), APP_NAME)
SETTINGS_FILE = os.path.join(SETTINGS_DIR, "settings.json")
GRID = 10
SEL = "#2a7de1"
UNDO_LIMIT = 80
CUSTOM = "Custom icons"
TEXT_INPUTS = (tk.Entry, tk.Text, tk.Spinbox, ttk.Entry, ttk.Spinbox, ttk.Combobox)
KIND_BY_NAME = {v["name"]: k for k, v in STENCILS.items()}


def load_settings():
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_settings(data):
    try:
        os.makedirs(SETTINGS_DIR, exist_ok=True)
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=1)
    except OSError:
        pass


def snap(v, on=True):
    return round(v / GRID) * GRID if on else v


class App:
    def __init__(self, root, path=None):
        self.root = root
        self.settings = load_settings()
        self.images = render.ImageStore()
        self.doc = dm.new_doc()
        self.page_idx = 0
        self.path = None
        self.modified = False
        self.zoom = 1.0
        self.sel = []                 # ordered ids (shapes and connectors)
        self.paths = {}               # connector id -> world points
        self.undo_stack, self.redo_stack = [], []
        self.drag = None
        self.clip = None
        self.paste_count = 0
        self._editor = None
        self._pal_drag = None
        self._prop_ids = []
        self._prop_loaded = {}
        self.region = (0, 0, 1600, 1100)

        self.tool = tk.StringVar(value="select")
        self.conn_style = tk.StringVar(value=self.settings.get("conn_style", "straight"))
        self.show_grid = tk.BooleanVar(value=self.settings.get("show_grid", True))
        self.snap_on = tk.BooleanVar(value=self.settings.get("snap", True))
        self.status = tk.StringVar()
        self.zoom_text = tk.StringVar(value="100%")
        self.pos_text = tk.StringVar()

        root.title(APP_NAME)
        try:
            root.iconbitmap(os.path.join(HERE, "app.ico"))
        except tk.TclError:
            pass
        root.geometry(self.settings.get("geometry", "1400x860"))
        if self.settings.get("zoomed", True):
            root.state("zoomed")
        self._styles()
        self._build_menu()
        self._build_toolbar()
        self._build_body()
        self._bind_keys()
        self._load_custom_icons()
        self.fill_palette()
        root.protocol("WM_DELETE_WINDOW", self.on_close)
        self.tool.trace_add("write", lambda *a: self._tool_changed())

        if path and os.path.exists(path):
            root.after(50, lambda: self.open_file(path))
        else:
            root.after(50, self.redraw_all)
        self.rebuild_page_tabs()
        self.update_title()
        self.set_status("Drag devices from the left onto the page.  Ctrl+3 = connector tool, "
                        "middle-drag = pan, Ctrl+wheel = zoom.")

    # ================================================================= UI build
    def _styles(self):
        st = ttk.Style()
        st.configure("Head.TLabel", font=("Segoe UI", 9, "bold"), foreground="#34495e")
        st.configure("PanelHead.TLabel", font=("Segoe UI", 10, "bold"), foreground="#1b2f45")
        st.configure("Small.TLabel", font=("Segoe UI", 8), foreground="#555555")

    def _cmd(self, fn):
        """Wrap a command so pending property edits are applied first."""
        def run(*_):
            self.end_edit(True)
            self.commit_props()
            fn()
            return "break"
        return run

    def _build_menu(self):
        m = tk.Menu(self.root)
        C = self._cmd

        f = tk.Menu(m, tearoff=0)
        f.add_command(label="New", accelerator="Ctrl+N", command=C(self.new_file))
        f.add_command(label="Open...", accelerator="Ctrl+O", command=C(self.open_dialog))
        f.add_command(label="Save", accelerator="Ctrl+S", command=C(self.save))
        f.add_command(label="Save As...", accelerator="Ctrl+Shift+S", command=C(self.save_as))
        f.add_separator()
        f.add_command(label="Export page as PNG...", command=C(self.export_png))
        f.add_command(label="Export page as SVG...", command=C(self.export_svg))
        f.add_command(label="Export all pages to PDF...", command=C(self.export_pdf))
        f.add_command(label="Copy page as image", accelerator="Ctrl+Shift+C", command=C(self.copy_image))
        f.add_separator()
        f.add_command(label="Export device/link inventory to Excel...", command=C(self.export_inventory))
        f.add_separator()
        f.add_command(label="Exit", command=self.on_close)
        m.add_cascade(label="File", menu=f)

        e = tk.Menu(m, tearoff=0)
        e.add_command(label="Undo", accelerator="Ctrl+Z", command=C(self.undo))
        e.add_command(label="Redo", accelerator="Ctrl+Y", command=C(self.redo))
        e.add_separator()
        e.add_command(label="Cut", accelerator="Ctrl+X", command=C(self.cut))
        e.add_command(label="Copy", accelerator="Ctrl+C", command=C(self.copy))
        e.add_command(label="Paste", accelerator="Ctrl+V", command=C(self.paste))
        e.add_command(label="Duplicate", accelerator="Ctrl+D", command=C(self.duplicate))
        e.add_command(label="Delete", accelerator="Del", command=C(self.delete_selected))
        e.add_separator()
        e.add_command(label="Edit label", accelerator="F2", command=C(self.edit_selected_label))
        e.add_command(label="Select all", accelerator="Ctrl+A", command=C(self.select_all))
        m.add_cascade(label="Edit", menu=e)

        a = tk.Menu(m, tearoff=0)
        a.add_command(label="Bring to front", accelerator="Ctrl+Shift+F", command=C(self.bring_front))
        a.add_command(label="Send to back", accelerator="Ctrl+Shift+B", command=C(self.send_back))
        a.add_separator()
        for label, how in (("Align left", "left"), ("Align centre", "hcenter"), ("Align right", "right"),
                           ("Align top", "top"), ("Align middle", "vcenter"), ("Align bottom", "bottom")):
            a.add_command(label=label, command=C(lambda h=how: self.align(h)))
        a.add_separator()
        a.add_command(label="Distribute horizontally", command=C(lambda: self.distribute("h")))
        a.add_command(label="Distribute vertically", command=C(lambda: self.distribute("v")))
        a.add_command(label="Make same size", command=C(self.same_size))
        m.add_cascade(label="Arrange", menu=a)

        cm = tk.Menu(m, tearoff=0)
        cm.add_radiobutton(label="Pointer tool", accelerator="Ctrl+1", variable=self.tool, value="select")
        cm.add_radiobutton(label="Connector tool", accelerator="Ctrl+3", variable=self.tool, value="connect")
        cm.add_separator()
        cm.add_radiobutton(label="New connectors: straight", variable=self.conn_style, value="straight")
        cm.add_radiobutton(label="New connectors: right-angle", variable=self.conn_style, value="orthogonal")
        cm.add_separator()
        cm.add_command(label="Make selected straight", command=C(lambda: self.set_conn_field("style", "straight")))
        cm.add_command(label="Make selected right-angle",
                       command=C(lambda: self.set_conn_field("style", "orthogonal")))
        cm.add_command(label="Reverse selected", command=C(self.reverse_conns))
        m.add_cascade(label="Connectors", menu=cm)

        v = tk.Menu(m, tearoff=0)
        v.add_command(label="Zoom in", accelerator="Ctrl++", command=lambda: self.set_zoom(self.zoom * 1.25))
        v.add_command(label="Zoom out", accelerator="Ctrl+-", command=lambda: self.set_zoom(self.zoom / 1.25))
        v.add_command(label="Actual size", accelerator="Ctrl+0", command=lambda: self.set_zoom(1.0))
        v.add_command(label="Fit to window", accelerator="Ctrl+Shift+W", command=self.fit)
        v.add_separator()
        v.add_checkbutton(label="Show grid", variable=self.show_grid, command=self.redraw_all)
        v.add_checkbutton(label="Snap to grid", variable=self.snap_on)
        m.add_cascade(label="View", menu=v)

        p = tk.Menu(m, tearoff=0)
        p.add_command(label="New page", command=C(self.new_page))
        p.add_command(label="Duplicate page", command=C(self.duplicate_page))
        p.add_command(label="Rename page...", command=C(self.rename_page))
        p.add_command(label="Delete page", command=C(self.delete_page))
        m.add_cascade(label="Page", menu=p)

        h = tk.Menu(m, tearoff=0)
        h.add_command(label="How to use / shortcuts", command=self.show_help)
        m.add_cascade(label="Help", menu=h)
        self.root.config(menu=m)

    def _build_toolbar(self):
        bar = ttk.Frame(self.root, padding=(6, 4))
        bar.pack(side="top", fill="x")
        C = self._cmd

        def btn(text, cmd, tip=None):
            b = ttk.Button(bar, text=text, command=cmd, width=len(text) + 2 if len(text) > 2 else 3)
            b.pack(side="left", padx=1)
            if tip:
                self._tooltip(b, tip)
            return b

        def sep():
            ttk.Separator(bar, orient="vertical").pack(side="left", fill="y", padx=6)

        btn("New", C(self.new_file), "New diagram (Ctrl+N)")
        btn("Open", C(self.open_dialog), "Open (Ctrl+O)")
        btn("Save", C(self.save), "Save (Ctrl+S)")
        sep()
        btn("\u21b6", C(self.undo), "Undo (Ctrl+Z)")
        btn("\u21b7", C(self.redo), "Redo (Ctrl+Y)")
        sep()
        r1 = ttk.Radiobutton(bar, text="\u2196 Pointer", variable=self.tool, value="select", style="Toolbutton")
        r1.pack(side="left", padx=1)
        self._tooltip(r1, "Select / move / resize (Ctrl+1)")
        r2 = ttk.Radiobutton(bar, text="\u2571 Connector", variable=self.tool, value="connect", style="Toolbutton")
        r2.pack(side="left", padx=1)
        self._tooltip(r2, "Drag from one shape to another to link them (Ctrl+3)")
        cb = ttk.Combobox(bar, width=11, state="readonly", values=("straight", "orthogonal"),
                          textvariable=self.conn_style)
        cb.pack(side="left", padx=(4, 1))
        self._tooltip(cb, "Routing for new connectors")
        sep()
        btn("Delete", C(self.delete_selected), "Delete selection (Del)")
        btn("Front", C(self.bring_front), "Bring to front")
        btn("Back", C(self.send_back), "Send to back")
        sep()
        btn("\u2212", lambda: self.set_zoom(self.zoom / 1.25), "Zoom out (Ctrl+-)")
        ttk.Label(bar, textvariable=self.zoom_text, width=6, anchor="center").pack(side="left")
        btn("+", lambda: self.set_zoom(self.zoom * 1.25), "Zoom in (Ctrl++)")
        btn("Fit", self.fit, "Fit diagram to window")
        sep()
        btn("Export PNG", C(self.export_png), "Export this page as a PNG image")
        btn("Copy image", C(self.copy_image), "Copy this page to the clipboard (paste into Word/PPT/Outlook)")
        btn("Inventory", C(self.export_inventory), "Export devices and links to Excel")

    def _build_body(self):
        body = ttk.PanedWindow(self.root, orient="horizontal")
        body.pack(side="top", fill="both", expand=True)

        # palette
        pal = ttk.Frame(body, width=230)
        body.add(pal, weight=0)
        top = ttk.Frame(pal, padding=(6, 6, 6, 2))
        top.pack(fill="x")
        ttk.Label(top, text="Shapes", style="PanelHead.TLabel").pack(anchor="w")
        self.pal_search = tk.StringVar()
        ent = ttk.Entry(top, textvariable=self.pal_search)
        ent.pack(fill="x", pady=(3, 0))
        self._placeholder(ent, self.pal_search, "Search shapes...")
        self.pal_search.trace_add("write", lambda *a: self.fill_palette())
        wrap = ttk.Frame(pal)
        wrap.pack(fill="both", expand=True)
        self.pal_canvas = tk.Canvas(wrap, width=222, highlightthickness=0, bg="#f6f8fa")
        sb = ttk.Scrollbar(wrap, orient="vertical", command=self.pal_canvas.yview)
        self.pal_canvas.configure(yscrollcommand=sb.set)
        sb.pack(side="right", fill="y")
        self.pal_canvas.pack(side="left", fill="both", expand=True)
        self.pal_inner = tk.Frame(self.pal_canvas, bg="#f6f8fa")
        self.pal_canvas.create_window(0, 0, window=self.pal_inner, anchor="nw")
        self.pal_inner.bind("<Configure>", lambda e: self.pal_canvas.configure(
            scrollregion=self.pal_canvas.bbox("all")))

        # drawing area
        mid = ttk.Frame(body)
        body.add(mid, weight=1)
        cv_wrap = ttk.Frame(mid)
        cv_wrap.pack(fill="both", expand=True)
        self.canvas = tk.Canvas(cv_wrap, bg="#ffffff", highlightthickness=0,
                                xscrollincrement=20, yscrollincrement=20)
        hs = ttk.Scrollbar(cv_wrap, orient="horizontal", command=self.canvas.xview)
        vs = ttk.Scrollbar(cv_wrap, orient="vertical", command=self.canvas.yview)
        self.canvas.configure(xscrollcommand=hs.set, yscrollcommand=vs.set)
        self.canvas.grid(row=0, column=0, sticky="nsew")
        vs.grid(row=0, column=1, sticky="ns")
        hs.grid(row=1, column=0, sticky="ew")
        cv_wrap.rowconfigure(0, weight=1)
        cv_wrap.columnconfigure(0, weight=1)
        self.page_bar = tk.Frame(mid, bg="#e9edf2")
        self.page_bar.pack(fill="x")
        sbar = ttk.Frame(mid, padding=(6, 2))
        sbar.pack(fill="x")
        ttk.Label(sbar, textvariable=self.status, style="Small.TLabel").pack(side="left")
        ttk.Label(sbar, textvariable=self.pos_text, style="Small.TLabel", width=18,
                  anchor="e").pack(side="right")

        c = self.canvas
        c.bind("<ButtonPress-1>", self.on_press)
        c.bind("<B1-Motion>", self.on_drag)
        c.bind("<ButtonRelease-1>", self.on_release)
        c.bind("<Double-Button-1>", self.on_double)
        c.bind("<ButtonPress-3>", self.on_context)
        c.bind("<ButtonPress-2>", lambda e: (c.scan_mark(e.x, e.y), c.config(cursor="fleur")))
        c.bind("<B2-Motion>", lambda e: c.scan_dragto(e.x, e.y, gain=1))
        c.bind("<ButtonRelease-2>", lambda e: c.config(cursor=self._cursor()))
        c.bind("<Motion>", self.on_motion)
        self.root.bind_all("<MouseWheel>", self.on_wheel)

        # properties
        self.props = ttk.Frame(body, width=280, padding=(8, 6))
        body.add(self.props, weight=0)
        self._build_props()

        def place_sashes(_=None):
            W = body.winfo_width()
            if W > 900:
                body.sashpos(0, 235)
                body.sashpos(1, W - 300)
                body.unbind("<Configure>")
        body.bind("<Configure>", place_sashes)

    def _placeholder(self, entry, var, text):
        def show(*_):
            if not var.get():
                entry.configure(foreground="#999999")
                var.set(text)
                entry._ph = True

        def hide(*_):
            if getattr(entry, "_ph", False):
                entry._ph = False
                var.set("")
                entry.configure(foreground="#000000")
        entry.bind("<FocusIn>", hide)
        entry.bind("<FocusOut>", show)
        show()

    def _tooltip(self, widget, text):
        tip = {}

        def enter(_):
            tip["after"] = widget.after(600, show)

        def show():
            t = tk.Toplevel(widget)
            t.wm_overrideredirect(True)
            t.wm_geometry("+%d+%d" % (widget.winfo_rootx() + 4, widget.winfo_rooty() + widget.winfo_height() + 4))
            tk.Label(t, text=text, bg="#ffffe1", relief="solid", bd=1, font=("Segoe UI", 8),
                     padx=4, pady=2).pack()
            tip["win"] = t

        def leave(_):
            if "after" in tip:
                widget.after_cancel(tip.pop("after"))
            if "win" in tip:
                tip.pop("win").destroy()
        widget.bind("<Enter>", enter, add="+")
        widget.bind("<Leave>", leave, add="+")
        widget.bind("<ButtonPress>", leave, add="+")

    # ---------------------------------------------------------------- properties panel
    def _build_props(self):
        P = self.props
        self.prop_title = ttk.Label(P, text="Properties", style="PanelHead.TLabel")
        self.prop_title.pack(anchor="w")
        self.prop_hint = ttk.Label(P, text="Select a shape or connector.", style="Small.TLabel",
                                   wraplength=260, justify="left")
        self.prop_hint.pack(anchor="w", pady=(2, 6))
        self.vars = {}
        self.colors = {}
        self.color_btns = {}

        # --- shape frame
        sf = self.shape_frame = ttk.Frame(P)
        r = 0

        def row(label, widget, frame=sf):
            nonlocal r
            ttk.Label(frame, text=label).grid(row=r, column=0, sticky="nw", pady=2, padx=(0, 6))
            widget.grid(row=r, column=1, sticky="ew", pady=2)
            r += 1
            return widget

        sf.columnconfigure(1, weight=1)
        self.vars["kind"] = tk.StringVar()
        self.kind_cb = row("Type", ttk.Combobox(sf, textvariable=self.vars["kind"], state="readonly",
                                                values=[STENCILS[k]["name"] for k in STENCILS]))
        self.kind_cb.bind("<<ComboboxSelected>>", lambda e: self.commit_props())
        self.label_txt = row("Label", self._text(sf, 2))
        for key, lab in (("ip", "IP address"), ("model", "Model"), ("serial", "Serial no."),
                         ("location", "Location")):
            self.vars[key] = tk.StringVar()
            self._entry_commit(row(lab, ttk.Entry(sf, textvariable=self.vars[key])))
        self.notes_txt = row("Notes", self._text(sf, 3))
        self.vars["show_ip"] = tk.BooleanVar()
        row("", ttk.Checkbutton(sf, text="Show IP under label", variable=self.vars["show_ip"],
                                command=self.commit_props))
        ttk.Separator(sf).grid(row=r, column=0, columnspan=2, sticky="ew", pady=6)
        r += 1
        crow = ttk.Frame(sf)
        for key, lab in (("fill", "Fill"), ("line", "Line"), ("text_color", "Text")):
            ttk.Label(crow, text=lab).pack(side="left")
            self.color_btns[key] = self._color_button(crow, key)
            self.color_btns[key].pack(side="left", padx=(2, 8))
        row("Colours", crow)
        frow = ttk.Frame(sf)
        self.vars["font"] = tk.StringVar()
        self._entry_commit(self._spin(frow, self.vars["font"], 6, 48)).pack(side="left")
        self.vars["bold"] = tk.BooleanVar()
        ttk.Checkbutton(frow, text="Bold", variable=self.vars["bold"],
                        command=self.commit_props).pack(side="left", padx=8)
        row("Font size", frow)
        self.vars["lw"] = tk.StringVar()
        row("Line width", self._entry_commit(self._spin(sf, self.vars["lw"], 0, 8, 0.5)))
        grow = ttk.Frame(sf)
        for key in ("x", "y", "w", "h"):
            ttk.Label(grow, text=key.upper()).pack(side="left")
            self.vars[key] = tk.StringVar()
            self._entry_commit(ttk.Entry(grow, textvariable=self.vars[key], width=5)).pack(side="left", padx=(1, 4))
        row("Position", grow)

        # --- connector frame
        cf = self.conn_frame = ttk.Frame(P)
        cf.columnconfigure(1, weight=1)
        r = 0
        for key, lab in (("c_label", "Label"), ("src_label", "From port"), ("dst_label", "To port")):
            self.vars[key] = tk.StringVar()
            self._entry_commit(row(lab, ttk.Entry(cf, textvariable=self.vars[key]), cf))
        self.conn_ends = ttk.Label(cf, text="", style="Small.TLabel", wraplength=180, justify="left")
        row("", self.conn_ends, cf)
        for key, lab, values in (("style", "Routing", ("straight", "orthogonal")),
                                 ("dash", "Pattern", tuple(render.DASHES)),
                                 ("arrow", "Arrows", ("none", "end", "start", "both"))):
            self.vars[key] = tk.StringVar()
            w = row(lab, ttk.Combobox(cf, textvariable=self.vars[key], state="readonly", values=values), cf)
            w.bind("<<ComboboxSelected>>", lambda e: self.commit_props())
        crow2 = ttk.Frame(cf)
        ttk.Label(crow2, text="Line").pack(side="left")
        self.color_btns["color"] = self._color_button(crow2, "color")
        self.color_btns["color"].pack(side="left", padx=(2, 8))
        ttk.Label(crow2, text="Text").pack(side="left")
        self.color_btns["c_text_color"] = self._color_button(crow2, "c_text_color")
        self.color_btns["c_text_color"].pack(side="left", padx=2)
        row("Colours", crow2, cf)
        self.vars["width"] = tk.StringVar()
        row("Width", self._entry_commit(self._spin(cf, self.vars["width"], 0.5, 10, 0.5)), cf)
        self.vars["c_font"] = tk.StringVar()
        row("Font size", self._entry_commit(self._spin(cf, self.vars["c_font"], 6, 36)), cf)
        bt = ttk.Frame(cf)
        ttk.Button(bt, text="Reverse direction", command=self._cmd(self.reverse_conns)).pack(side="left")
        row("", bt, cf)

    def _text(self, parent, height):
        t = tk.Text(parent, height=height, width=24, wrap="word", font=("Segoe UI", 9),
                    relief="solid", bd=1, highlightthickness=0, undo=True)
        t.bind("<FocusOut>", lambda e: self.commit_props())
        return t

    def _spin(self, parent, var, lo, hi, inc=1):
        return ttk.Spinbox(parent, from_=lo, to=hi, increment=inc, textvariable=var, width=6,
                           command=self.commit_props)

    def _entry_commit(self, w):
        w.bind("<Return>", lambda e: self.commit_props())
        w.bind("<FocusOut>", lambda e: self.commit_props())
        return w

    def _color_button(self, parent, key):
        b = tk.Button(parent, width=2, relief="solid", bd=1, bg="#ffffff",
                      command=lambda: self._pick_color(key))
        return b

    def _pick_color(self, key):
        if not self._prop_ids:
            return
        cur = self.colors.get(key) or "#ffffff"
        res = colorchooser.askcolor(cur, parent=self.root, title="Choose colour")
        if res and res[1]:
            self.colors[key] = res[1]
            self.color_btns[key].configure(bg=res[1])
            self.commit_props()

    # ================================================================= helpers
    @property
    def page(self):
        return self.doc["pages"][self.page_idx]

    def by_id(self):
        d = {s["id"]: s for s in self.page["shapes"]}
        d.update({c["id"]: c for c in self.page["conns"]})
        return d

    def sel_shapes(self):
        d = {s["id"]: s for s in self.page["shapes"]}
        return [d[i] for i in self.sel if i in d]

    def sel_conns(self):
        d = {c["id"]: c for c in self.page["conns"]}
        return [d[i] for i in self.sel if i in d]

    def world(self, e):
        return self.canvas.canvasx(e.x) / self.zoom, self.canvas.canvasy(e.y) / self.zoom

    def set_status(self, text):
        self.status.set(text)

    def _cursor(self):
        return "crosshair" if self.tool.get() == "connect" else ""

    def _tool_changed(self):
        self.canvas.config(cursor=self._cursor())
        self.canvas.delete("hover")
        if self.tool.get() == "connect":
            self.set_status("Connector tool: drag from one shape to another.  Esc returns to the pointer.")
        else:
            self.set_status("Pointer tool.")

    def update_title(self):
        name = os.path.basename(self.path) if self.path else "Untitled"
        self.root.title("%s%s - %s" % ("*" if self.modified else "", name, APP_NAME))

    def snapshot(self):
        return json.dumps({"doc": self.doc, "page": self.page_idx})

    def push_undo(self, snap=None):
        self.undo_stack.append(snap or self.snapshot())
        if len(self.undo_stack) > UNDO_LIMIT:
            del self.undo_stack[0]
        self.redo_stack.clear()
        if not self.modified:
            self.modified = True
            self.update_title()

    def _restore(self, snap):
        data = json.loads(snap)
        self.doc = data["doc"]
        self.page_idx = min(data["page"], len(self.doc["pages"]) - 1)
        for k, v in self.doc.get("images", {}).items():
            self.images.register(k, v)
        ids = self.by_id()
        self.sel = [i for i in self.sel if i in ids]
        self.rebuild_page_tabs()
        self.redraw_all()
        self.refresh_props()

    def undo(self):
        if not self.undo_stack:
            return self.set_status("Nothing to undo.")
        self.redo_stack.append(self.snapshot())
        self._restore(self.undo_stack.pop())
        self.modified = True
        self.update_title()

    def redo(self):
        if not self.redo_stack:
            return self.set_status("Nothing to redo.")
        self.undo_stack.append(self.snapshot())
        self._restore(self.redo_stack.pop())
        self.modified = True
        self.update_title()

    # ================================================================= drawing
    def redraw_all(self):
        self.cancel_edit()
        c = self.canvas
        c.delete("all")
        self.paths = dm.connector_paths(self.page)
        self._update_region()
        self._draw_grid()
        b = render.TkBackend(c, self.zoom, images=self.images)
        for s in dm.draw_order(self.page):
            b.tags = (s["id"], "cont" if dm.is_container(s) else "shape")
            render.draw_shape(b, s)
        for cn in self.page["conns"]:
            if cn["id"] in self.paths:
                b.tags = (cn["id"], "conn")
                render.draw_connector(b, cn, self.paths[cn["id"]])
        self.restack()
        self.draw_overlay()
        self.zoom_text.set("%d%%" % round(self.zoom * 100))

    def redraw_shape(self, s):
        self.canvas.delete(s["id"])
        b = render.TkBackend(self.canvas, self.zoom, images=self.images)
        b.tags = (s["id"], "cont" if dm.is_container(s) else "shape")
        render.draw_shape(b, s)

    def redraw_conns_for(self, shape_ids):
        self.paths = dm.connector_paths(self.page)
        b = render.TkBackend(self.canvas, self.zoom, images=self.images)
        for cn in self.page["conns"]:
            if cn["src"] in shape_ids or cn["dst"] in shape_ids:
                self.canvas.delete(cn["id"])
                b.tags = (cn["id"], "conn")
                render.draw_connector(b, cn, self.paths[cn["id"]])

    def restack(self):
        c = self.canvas
        shapes = dm.draw_order(self.page)
        for s in reversed([s for s in shapes if dm.is_container(s)]):
            c.tag_lower(s["id"])
        c.tag_lower("grid")
        c.tag_raise("conn")
        for s in shapes:
            if not dm.is_container(s):
                c.tag_raise(s["id"])
        c.tag_raise("overlay")

    def _update_region(self):
        bb = dm.page_bbox(self.page, self.paths) or (0, 0, 0, 0)
        self.region = (min(bb[0], 0) - 400, min(bb[1], 0) - 400, max(bb[2], 1600) + 400, max(bb[3], 1100) + 400)
        z = self.zoom
        self.canvas.config(scrollregion=tuple(v * z for v in self.region))

    def _draw_grid(self):
        if not self.show_grid.get():
            return
        c, z = self.canvas, self.zoom
        step = 20
        while step * z < 12:
            step *= 2
        x0, y0, x1, y1 = self.region
        sx = math.floor(x0 / step) * step
        sy = math.floor(y0 / step) * step
        x = sx
        while x <= x1:
            major = (x // step) % 5 == 0
            c.create_line(x * z, y0 * z, x * z, y1 * z, fill="#dfe6ee" if major else "#eff3f7", tags="grid")
            x += step
        y = sy
        while y <= y1:
            major = (y // step) % 5 == 0
            c.create_line(x0 * z, y * z, x1 * z, y * z, fill="#dfe6ee" if major else "#eff3f7", tags="grid")
            y += step

    def draw_overlay(self):
        c, z = self.canvas, self.zoom
        c.delete("overlay")
        shapes = self.sel_shapes()
        for s in shapes:
            c.create_rectangle(s["x"] * z - 3, s["y"] * z - 3, (s["x"] + s["w"]) * z + 3,
                               (s["y"] + s["h"]) * z + 3, outline=SEL, dash=(3, 2), tags="overlay")
        for cn in self.sel_conns():
            pts = self.paths.get(cn["id"])
            if not pts:
                continue
            flat = [v * z for p in pts for v in p]
            c.create_line(flat, fill=SEL, width=1, dash=(3, 2), tags="overlay")
            for (x, y) in (pts[0], pts[-1]):
                c.create_rectangle(x * z - 4, y * z - 4, x * z + 4, y * z + 4, fill="#ffffff",
                                   outline=SEL, tags="overlay")
        if len(shapes) == 1 and len(self.sel) == 1:
            for _, (x, y) in self._handles(shapes[0]):
                c.create_rectangle(x - 4, y - 4, x + 4, y + 4, fill="#ffffff", outline=SEL, tags="overlay")
        n = len(self.sel)
        if n > 1:
            self.set_status("%d items selected" % n)

    def _handles(self, s):
        z = self.zoom
        x0, y0 = s["x"] * z - 3, s["y"] * z - 3
        x1, y1 = (s["x"] + s["w"]) * z + 3, (s["y"] + s["h"]) * z + 3
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        return [("nw", (x0, y0)), ("n", (mx, y0)), ("ne", (x1, y0)), ("e", (x1, my)),
                ("se", (x1, y1)), ("s", (mx, y1)), ("sw", (x0, y1)), ("w", (x0, my))]

    # ================================================================= hit testing
    def hit_test(self, wx, wy):
        tol = 4 / self.zoom
        order = dm.draw_order(self.page)
        for s in reversed([s for s in order if not dm.is_container(s)]):
            if s["x"] - tol <= wx <= s["x"] + s["w"] + tol and s["y"] - tol <= wy <= s["y"] + s["h"] + tol:
                return s
            lb = render.label_box(s)
            if lb and lb[0] - tol <= wx <= lb[2] + tol and lb[1] <= wy <= lb[3]:
                return s
        for cn in reversed(self.page["conns"]):
            pts = self.paths.get(cn["id"])
            if pts and render.dist_to_polyline(pts, wx, wy) <= tol + cn.get("width", 2) / 2 + 1:
                return cn
        edge = 8 / self.zoom
        for s in reversed([s for s in order if dm.is_container(s)]):
            x0, y0, x1, y1 = s["x"], s["y"], s["x"] + s["w"], s["y"] + s["h"]
            if x0 - tol <= wx <= x1 + tol and y0 - tol <= wy <= y1 + tol:
                near_edge = min(wx - x0, x1 - wx, wy - y0, y1 - wy) <= edge
                in_title = wy <= y0 + s.get("font", 13) * 2.2
                if near_edge or in_title:
                    return s
        return None

    def hit_shape(self, wx, wy):
        for s in reversed(dm.draw_order(self.page)):
            if s["x"] <= wx <= s["x"] + s["w"] and s["y"] <= wy <= s["y"] + s["h"]:
                return s
            lb = render.label_box(s)
            if lb and lb[0] <= wx <= lb[2] and lb[1] <= wy <= lb[3]:
                return s
        return None

    def hit_handle(self, e):
        shapes = self.sel_shapes()
        if len(shapes) != 1 or len(self.sel) != 1:
            return None
        cx, cy = self.canvas.canvasx(e.x), self.canvas.canvasy(e.y)
        for name, (x, y) in self._handles(shapes[0]):
            if abs(cx - x) <= 6 and abs(cy - y) <= 6:
                return name
        return None

    # ================================================================= mouse
    def on_press(self, e):
        self.end_edit(True)
        self.commit_props()
        self.canvas.focus_set()
        wx, wy = self.world(e)
        additive = bool(e.state & 0x0001) or bool(e.state & 0x0004)
        if self.tool.get() == "connect":
            s = self.hit_shape(wx, wy)
            if s:
                cx, cy = s["x"] + s["w"] / 2, s["y"] + s["h"] / 2
                z = self.zoom
                line = self.canvas.create_line(cx * z, cy * z, wx * z, wy * z, fill=SEL, width=2,
                                               dash=(4, 3), tags="overlay")
                self.drag = {"mode": "connect", "src": s["id"], "line": line, "c": (cx, cy)}
            return
        handle = self.hit_handle(e)
        if handle:
            s = self.sel_shapes()[0]
            self.drag = {"mode": "resize", "id": s["id"], "h": handle, "start": (wx, wy),
                         "orig": (s["x"], s["y"], s["w"], s["h"]), "undo": self.snapshot(), "moved": False}
            return
        item = self.hit_test(wx, wy)
        if item:
            iid = item["id"]
            if additive:
                if iid in self.sel:
                    self.sel.remove(iid)
                else:
                    self.sel.append(iid)
            elif iid not in self.sel:
                self.sel = [iid]
            shapes = self.sel_shapes()
            if iid in self.sel and "kind" in item and shapes:
                ids = [s["id"] for s in shapes]
                for cont in [s for s in shapes if dm.is_container(s)]:
                    for s in self.page["shapes"]:
                        if s["id"] not in ids and self._inside(s, cont):
                            ids.append(s["id"])
                d = {s["id"]: s for s in self.page["shapes"]}
                self.drag = {"mode": "move", "ids": ids, "anchor": iid, "start": (wx, wy),
                             "orig": {i: (d[i]["x"], d[i]["y"]) for i in ids},
                             "undo": self.snapshot(), "moved": False}
        else:
            if not additive:
                self.sel = []
            z = self.zoom
            rect = self.canvas.create_rectangle(wx * z, wy * z, wx * z, wy * z, outline=SEL,
                                                dash=(3, 2), fill="", tags="overlay")
            self.drag = {"mode": "rubber", "start": (wx, wy), "rect": rect, "base": list(self.sel)}
        self.draw_overlay()
        self.refresh_props()

    @staticmethod
    def _inside(s, cont):
        return (s is not cont and s["x"] >= cont["x"] and s["y"] >= cont["y"]
                and s["x"] + s["w"] <= cont["x"] + cont["w"] and s["y"] + s["h"] <= cont["y"] + cont["h"])

    def on_drag(self, e):
        d = self.drag
        if not d:
            return
        wx, wy = self.world(e)
        z = self.zoom
        self._autoscroll(e)
        if d["mode"] == "connect":
            cx, cy = d["c"]
            self.canvas.coords(d["line"], cx * z, cy * z, wx * z, wy * z)
            self._hover(wx, wy, exclude=d["src"])
        elif d["mode"] == "rubber":
            sx, sy = d["start"]
            self.canvas.coords(d["rect"], sx * z, sy * z, wx * z, wy * z)
        elif d["mode"] == "move":
            dx, dy = wx - d["start"][0], wy - d["start"][1]
            if not d["moved"] and math.hypot(dx, dy) * z < 3:
                return
            d["moved"] = True
            shapes = {s["id"]: s for s in self.page["shapes"]}
            a = shapes[d["anchor"]]
            ax, ay = d["orig"][d["anchor"]]
            on = self.snap_on.get() and not (e.state & 0x0008)   # Alt disables snapping
            nx = snap(ax + dx + a["w"] / 2, on) - a["w"] / 2
            ny = snap(ay + dy + a["h"] / 2, on) - a["h"] / 2
            ddx, ddy = nx - ax, ny - ay
            for i in d["ids"]:
                s = shapes[i]
                ox, oy = d["orig"][i]
                mx, my = ox + ddx - s["x"], oy + ddy - s["y"]
                if mx or my:
                    s["x"], s["y"] = ox + ddx, oy + ddy
                    self.canvas.move(i, mx * z, my * z)
            self.redraw_conns_for(set(d["ids"]))
            self.restack()
            self.draw_overlay()
            self.pos_text.set("X %d  Y %d" % (a["x"], a["y"]))
        elif d["mode"] == "resize":
            self._do_resize(d, wx, wy, bool(e.state & 0x0001))

    def _do_resize(self, d, wx, wy, keep_ratio):
        s = {s["id"]: s for s in self.page["shapes"]}[d["id"]]
        ox, oy, ow, oh = d["orig"]
        dx, dy = wx - d["start"][0], wy - d["start"][1]
        if not d["moved"] and math.hypot(dx, dy) * self.zoom < 2:
            return
        d["moved"] = True
        x0, y0, x1, y1 = ox, oy, ox + ow, oy + oh
        h = d["h"]
        on = self.snap_on.get()
        if "w" in h:
            x0 = min(snap(x0 + dx, on), x1 - 10)
        if "e" in h:
            x1 = max(snap(x1 + dx, on), x0 + 10)
        if "n" in h:
            y0 = min(snap(y0 + dy, on), y1 - 10)
        if "s" in h:
            y1 = max(snap(y1 + dy, on), y0 + 10)
        if keep_ratio and len(h) == 2 and oh:
            ratio = ow / oh
            nh = (x1 - x0) / ratio
            if "n" in h:
                y0 = y1 - nh
            else:
                y1 = y0 + nh
        s["x"], s["y"], s["w"], s["h"] = x0, y0, x1 - x0, y1 - y0
        self.redraw_shape(s)
        self.redraw_conns_for({s["id"]})
        self.restack()
        self.draw_overlay()
        self.pos_text.set("W %d  H %d" % (s["w"], s["h"]))

    def on_release(self, e):
        d, self.drag = self.drag, None
        if not d:
            return
        wx, wy = self.world(e)
        if d["mode"] == "connect":
            self.canvas.delete(d["line"])
            self.canvas.delete("hover")
            t = self.hit_shape(wx, wy)
            if t and t["id"] != d["src"]:
                self.push_undo()
                cn = dm.new_conn(self.doc, d["src"], t["id"], self.conn_style.get())
                self.page["conns"].append(cn)
                self.sel = [cn["id"]]
                self.redraw_all()
                self.refresh_props()
            return
        if d["mode"] == "rubber":
            self.canvas.delete(d["rect"])
            sx, sy = d["start"]
            x0, x1 = sorted((sx, wx))
            y0, y1 = sorted((sy, wy))
            if (x1 - x0) * self.zoom < 3 and (y1 - y0) * self.zoom < 3:
                self.draw_overlay()
                return
            picked = [s["id"] for s in self.page["shapes"]
                      if s["x"] >= x0 and s["y"] >= y0 and s["x"] + s["w"] <= x1 and s["y"] + s["h"] <= y1]
            for cn in self.page["conns"]:
                pts = self.paths.get(cn["id"], [])
                if pts and all(x0 <= x <= x1 and y0 <= y <= y1 for x, y in pts):
                    picked.append(cn["id"])
            self.sel = d["base"] + [i for i in picked if i not in d["base"]]
            self.draw_overlay()
            self.refresh_props()
            return
        if d.get("moved"):
            self.push_undo(d["undo"])
            self.redraw_all()
            self.refresh_props()

    def _autoscroll(self, e):
        c = self.canvas
        w, h = c.winfo_width(), c.winfo_height()
        if e.x < 10:
            c.xview_scroll(-1, "units")
        elif e.x > w - 10:
            c.xview_scroll(1, "units")
        if e.y < 10:
            c.yview_scroll(-1, "units")
        elif e.y > h - 10:
            c.yview_scroll(1, "units")

    def _hover(self, wx, wy, exclude=None):
        c, z = self.canvas, self.zoom
        c.delete("hover")
        s = self.hit_shape(wx, wy)
        if s and s["id"] != exclude:
            c.create_rectangle(s["x"] * z - 4, s["y"] * z - 4, (s["x"] + s["w"]) * z + 4,
                               (s["y"] + s["h"]) * z + 4, outline="#27ae60", width=2, tags=("hover", "overlay"))

    def on_motion(self, e):
        wx, wy = self.world(e)
        self.pos_text.set("X %d  Y %d" % (wx, wy))
        if self.tool.get() == "connect":
            self._hover(wx, wy)
        else:
            h = self.hit_handle(e)
            cur = {"n": "sb_v_double_arrow", "s": "sb_v_double_arrow", "e": "sb_h_double_arrow",
                   "w": "sb_h_double_arrow", "nw": "size_nw_se", "se": "size_nw_se",
                   "ne": "size_ne_sw", "sw": "size_ne_sw"}.get(h, "")
            if self.canvas.cget("cursor") != cur:
                self.canvas.config(cursor=cur)

    def on_double(self, e):
        wx, wy = self.world(e)
        item = self.hit_test(wx, wy) if self.tool.get() == "select" else None
        if item:
            self.sel = [item["id"]]
            self.draw_overlay()
            self.refresh_props()
            self.begin_edit(item)

    def on_wheel(self, e):
        try:
            w = self.root.winfo_containing(e.x_root, e.y_root)
        except (KeyError, tk.TclError):   # e.g. a combobox drop-down list
            return
        steps = -e.delta / 120
        if w is self.canvas:
            if e.state & 0x0004:
                f = 1.15 ** (e.delta / 120)
                self.set_zoom(self.zoom * f, e.x_root - self.canvas.winfo_rootx(),
                              e.y_root - self.canvas.winfo_rooty())
            elif e.state & 0x0001:
                self.canvas.xview_scroll(int(steps * 3), "units")
            else:
                self.canvas.yview_scroll(int(steps * 3), "units")
            return
        while w is not None:
            if w is self.pal_canvas:
                self.pal_canvas.yview_scroll(int(steps * 2), "units")
                return
            w = w.master

    def on_context(self, e):
        self.end_edit(True)
        self.commit_props()
        wx, wy = self.world(e)
        item = self.hit_test(wx, wy)
        if item and item["id"] not in self.sel:
            self.sel = [item["id"]]
            self.draw_overlay()
            self.refresh_props()
        C = self._cmd
        m = tk.Menu(self.root, tearoff=0)
        if item:
            m.add_command(label="Edit label", accelerator="F2", command=C(lambda: self.begin_edit(item)))
            if "src" in item:
                m.add_command(label="Straight", command=C(lambda: self.set_conn_field("style", "straight")))
                m.add_command(label="Right-angle", command=C(lambda: self.set_conn_field("style", "orthogonal")))
                m.add_command(label="Reverse direction", command=C(self.reverse_conns))
            else:
                m.add_command(label="Cut", command=C(self.cut))
                m.add_command(label="Copy", command=C(self.copy))
                m.add_command(label="Duplicate", command=C(self.duplicate))
                m.add_separator()
                m.add_command(label="Bring to front", command=C(self.bring_front))
                m.add_command(label="Send to back", command=C(self.send_back))
            m.add_separator()
            m.add_command(label="Delete", command=C(self.delete_selected))
        else:
            m.add_command(label="Paste here", command=C(lambda: self.paste(at=(wx, wy))),
                          state="normal" if self.clip else "disabled")
            m.add_command(label="Select all", command=C(self.select_all))
            m.add_command(label="Fit to window", command=self.fit)
        m.tk_popup(e.x_root, e.y_root)

    # ================================================================= zoom
    def set_zoom(self, z, cx=None, cy=None):
        z = max(0.1, min(5.0, z))
        c = self.canvas
        if cx is None:
            cx, cy = c.winfo_width() / 2, c.winfo_height() / 2
        wx, wy = c.canvasx(cx) / self.zoom, c.canvasy(cy) / self.zoom
        self.zoom = z
        self.redraw_all()
        self._scroll_to(wx * z - cx, wy * z - cy)

    def _scroll_to(self, left, top):
        x0, y0, x1, y1 = (v * self.zoom for v in self.region)
        self.canvas.xview_moveto((left - x0) / (x1 - x0))
        self.canvas.yview_moveto((top - y0) / (y1 - y0))

    def fit(self):
        bb = dm.page_bbox(self.page, self.paths)
        c = self.canvas
        c.update_idletasks()
        W, H = max(200, c.winfo_width()), max(200, c.winfo_height())
        if not bb:
            self.zoom = 1.0
            self.redraw_all()
            return self._scroll_to(-40, -40)
        bw, bh = bb[2] - bb[0] + 60, bb[3] - bb[1] + 60
        self.zoom = max(0.1, min(2.0, W / bw, H / bh))
        self.redraw_all()
        z = self.zoom
        self._scroll_to((bb[0] + bb[2]) / 2 * z - W / 2, (bb[1] + bb[3]) / 2 * z - H / 2)

    def view_center(self):
        c = self.canvas
        return (c.canvasx(c.winfo_width() / 2) / self.zoom, c.canvasy(c.winfo_height() / 2) / self.zoom)

    # ================================================================= inline label editor
    def begin_edit(self, item):
        self.end_edit(True)
        z = self.zoom
        if "src" in item:
            pts = self.paths.get(item["id"])
            if not pts:
                return
            x, y = render.point_along(pts, render.path_length(pts) / 2)
            anchor = "center"
        else:
            pos = render.label_pos(item)
            if pos == "top":
                x, y, anchor = item["x"] + 8, item["y"] + 4, "nw"
            elif pos == "inside":
                x, y, anchor = item["x"] + item["w"] / 2, item["y"] + item["h"] / 2, "center"
            else:
                x, y, anchor = item["x"] + item["w"] / 2, item["y"] + item["h"] + 2, "n"
        text = item.get("label", "")
        lines = text.split("\n")
        t = tk.Text(self.canvas, width=max(14, min(40, max(len(l) for l in lines) + 2)),
                    height=max(1, len(lines)), font=("Segoe UI", 10), relief="solid", bd=1,
                    wrap="none", undo=True)
        t.insert("1.0", text)
        t.tag_add("sel", "1.0", "end-1c")
        win = self.canvas.create_window(x * z, y * z, window=t, anchor=anchor, tags="editor")
        self._editor = (t, win, item["id"])
        t.focus_set()

        def grow(_=None):
            n = int(t.index("end-1c").split(".")[0])
            t.configure(height=max(1, n))
        t.bind("<Return>", lambda e: (self.end_edit(True), "break")[1])
        t.bind("<Shift-Return>", lambda e: (t.insert("insert", "\n"), grow(), "break")[2])
        t.bind("<Escape>", lambda e: (self.end_edit(False), "break")[1])
        t.bind("<FocusOut>", lambda e: self.end_edit(True))
        self.set_status("Editing label: Enter = done, Shift+Enter = new line, Esc = cancel.")

    def cancel_edit(self):
        if self._editor:
            t, win, _ = self._editor
            self._editor = None
            t.destroy()

    def end_edit(self, commit):
        if not self._editor:
            return
        t, win, iid = self._editor
        text = t.get("1.0", "end-1c").strip("\n")
        self._editor = None
        self.canvas.delete(win)
        t.destroy()
        item = self.by_id().get(iid)
        if commit and item is not None and text != item.get("label", ""):
            self.push_undo()
            item["label"] = text
            self.redraw_all()
            self.refresh_props()
        self.canvas.focus_set()

    def edit_selected_label(self):
        if len(self.sel) == 1:
            item = self.by_id().get(self.sel[0])
            if item:
                self.begin_edit(item)

    # ================================================================= properties load/commit
    def refresh_props(self):
        shapes, conns = self.sel_shapes(), self.sel_conns()
        self.shape_frame.pack_forget()
        self.conn_frame.pack_forget()
        self._prop_ids = []
        self._prop_loaded = {}
        if shapes and not conns:
            self._prop_ids = [s["id"] for s in shapes]
            self._load_shape_panel(shapes)
            self.shape_frame.pack(fill="x")
        elif conns and not shapes:
            self._prop_ids = [c["id"] for c in conns]
            self._load_conn_panel(conns)
            self.conn_frame.pack(fill="x")
        else:
            self.prop_title.configure(text="Properties")
            self.prop_hint.configure(text="Select a shape or connector." if not self.sel else
                                     "%d shapes and %d connectors selected." % (len(shapes), len(conns)))
        self._prop_loaded = self._panel_values()

    def _set_text(self, widget, value, enabled=True):
        widget.configure(state="normal")
        widget.delete("1.0", "end")
        widget.insert("1.0", value)
        widget.edit_reset()
        widget.configure(state="normal" if enabled else "disabled",
                         bg="#ffffff" if enabled else "#f0f0f0")

    def _load_shape_panel(self, shapes):
        s = shapes[0]
        multi = len(shapes) > 1
        st = STENCILS.get(s["kind"])
        self.prop_title.configure(text="%d shapes" % len(shapes) if multi else
                                  (st["name"] if st else "%s icon" % (s["kind"][4:].split("/")[0]
                                                                      if "/" in s["kind"] else "Custom")))
        self.prop_hint.configure(text="Changes apply to all selected shapes." if multi else
                                 "Double-click the shape on the page to edit its label.")
        V = self.vars
        if s["kind"].startswith("img:"):
            V["kind"].set("Custom icon")
            self.kind_cb.configure(state="disabled")
        else:
            V["kind"].set(st["name"] if st else "")
            self.kind_cb.configure(state="readonly")
        self._set_text(self.label_txt, s.get("label", ""), not multi)
        d = s.get("data", {})
        for key in ("ip", "model", "serial", "location"):
            V[key].set(d.get(key, ""))
        self._set_text(self.notes_txt, d.get("notes", ""), not multi)
        V["show_ip"].set(s.get("show_ip", True))
        fill = s.get("fill") or (st["fill"] if st else "#ffffff")
        line = s.get("line") or (st["line"] if st else "#34495e")
        for key, val in (("fill", fill), ("line", line), ("text_color", s.get("text_color", "#1a1a1a"))):
            self.colors[key] = val
            self.color_btns[key].configure(bg=val)
        V["font"].set(s.get("font", 11))
        V["bold"].set(s.get("bold", False))
        V["lw"].set(s.get("lw", 1.5))
        for key in ("x", "y", "w", "h"):
            V[key].set("%g" % round(s[key], 1))

    def _load_conn_panel(self, conns):
        c = conns[0]
        multi = len(conns) > 1
        self.prop_title.configure(text="%d connectors" % len(conns) if multi else "Connector")
        self.prop_hint.configure(text="Changes apply to all selected connectors." if multi else
                                 "Port labels sit at each end of the link (e.g. Gi1/0/1).")
        V = self.vars
        V["c_label"].set(c.get("label", ""))
        V["src_label"].set(c.get("src_label", ""))
        V["dst_label"].set(c.get("dst_label", ""))
        shapes = {s["id"]: s for s in self.page["shapes"]}
        a, b = shapes.get(c["src"], {}), shapes.get(c["dst"], {})
        self.conn_ends.configure(text="" if multi else "%s  \u2192  %s" % (
            a.get("label", "?").replace("\n", " ") or "(unnamed)", b.get("label", "?").replace("\n", " ") or "(unnamed)"))
        V["style"].set(c.get("style", "straight"))
        V["dash"].set(c.get("dash", "solid"))
        V["arrow"].set(c.get("arrow", "none"))
        V["width"].set(c.get("width", 2))
        V["c_font"].set(c.get("font", 9))
        for key, val in (("color", c.get("color", "#2c3e50")), ("c_text_color", c.get("text_color", "#1a1a1a"))):
            self.colors[key] = val
            self.color_btns[key].configure(bg=val)

    def _panel_values(self):
        if not self._prop_ids:
            return {}
        V = self.vars
        first = self.by_id().get(self._prop_ids[0])
        if first is None:
            return {}
        if "src" in first:
            return {"label": V["c_label"].get(), "src_label": V["src_label"].get(),
                    "dst_label": V["dst_label"].get(), "style": V["style"].get(), "dash": V["dash"].get(),
                    "arrow": V["arrow"].get(), "width": V["width"].get(), "font": V["c_font"].get(),
                    "color": self.colors.get("color"), "text_color": self.colors.get("c_text_color")}
        vals = {"kind": V["kind"].get(), "label": self.label_txt.get("1.0", "end-1c"),
                "notes": self.notes_txt.get("1.0", "end-1c"), "show_ip": V["show_ip"].get(),
                "fill": self.colors.get("fill"), "line": self.colors.get("line"),
                "text_color": self.colors.get("text_color"), "font": V["font"].get(),
                "bold": V["bold"].get(), "lw": V["lw"].get()}
        for key in ("ip", "model", "serial", "location", "x", "y", "w", "h"):
            vals[key] = V[key].get()
        return vals

    def commit_props(self):
        if not self._prop_ids or not self._prop_loaded:
            return
        now = self._panel_values()
        changed = {k: v for k, v in now.items() if self._prop_loaded.get(k) != v}
        if not changed:
            return
        items = [i for i in (self.by_id().get(x) for x in self._prop_ids) if i is not None]
        if not items:
            return
        self.push_undo()
        for it in items:
            for k, v in changed.items():
                self._apply_field(it, k, v)
        self._prop_loaded = now
        self.redraw_all()

    @staticmethod
    def _num(v, lo, hi, default):
        try:
            return max(lo, min(hi, float(v)))
        except (TypeError, ValueError):
            return default

    def _apply_field(self, it, k, v):
        if "src" in it:
            if k in ("width",):
                it[k] = self._num(v, 0.5, 10, it.get(k, 2))
            elif k == "font":
                it[k] = int(self._num(v, 6, 36, it.get(k, 9)))
            else:
                it[k] = v
            return
        if k == "kind":
            kind = KIND_BY_NAME.get(v)
            if kind and not it["kind"].startswith("img:"):
                it["kind"] = kind
        elif k in ("ip", "model", "serial", "location", "notes"):
            it.setdefault("data", {})[k] = v.strip() if k != "notes" else v
        elif k in ("x", "y"):
            it[k] = self._num(v, -1e6, 1e6, it[k])
        elif k in ("w", "h"):
            it[k] = self._num(v, 8, 1e5, it[k])
        elif k == "font":
            it[k] = int(self._num(v, 6, 48, it.get(k, 11)))
        elif k == "lw":
            it[k] = self._num(v, 0, 8, it.get(k, 1.5))
        else:
            it[k] = v

    # ================================================================= palette
    def _load_custom_icons(self):
        """Icon library: icons\\*.png -> 'Custom icons'; icons\\<Folder>\\*.png -> category <Folder>.

        Library icons are keyed 'Folder/Name' (root ones just 'Name') and only decoded when shown.
        """
        self.libs = {CUSTOM: []}
        self.icon_files = {}
        if not os.path.isdir(ICON_DIR):
            return
        exts = (".png", ".gif", ".jpg", ".jpeg")
        for entry in sorted(os.listdir(ICON_DIR), key=str.lower):
            path = os.path.join(ICON_DIR, entry)
            if os.path.isdir(path):
                keys = []
                for fn in sorted(os.listdir(path), key=str.lower):
                    if fn.lower().endswith(exts):
                        key = "%s/%s" % (entry, os.path.splitext(fn)[0])
                        self.icon_files[key] = os.path.join(path, fn)
                        keys.append(key)
                if keys:
                    self.libs[entry] = keys
            elif entry.lower().endswith(exts):
                key = os.path.splitext(entry)[0]
                self.icon_files[key] = path
                self.libs[CUSTOM].append(key)

    def _ensure_icon(self, key):
        """Make sure a library icon's image data is loaded into the image store."""
        if key in self.images.data or key not in self.icon_files:
            return key in self.images.data
        path = self.icon_files[key]
        try:
            if path.lower().endswith(".png"):
                with open(path, "rb") as f:
                    data = base64.b64encode(f.read()).decode("ascii")
            else:
                data = self._icon_png_b64(path)
        except OSError:
            return False
        self.images.register(key, data)
        return True

    @staticmethod
    def _icon_png_b64(path):
        from PIL import Image
        import io
        im = Image.open(path).convert("RGBA")
        im.thumbnail((256, 256))
        buf = io.BytesIO()
        im.save(buf, "PNG")
        return base64.b64encode(buf.getvalue()).decode("ascii")

    def fill_palette(self):
        for w in self.pal_inner.winfo_children():
            w.destroy()
        q = self.pal_search.get().strip().lower()
        if q == "search shapes...":
            q = ""
        bg = "#f6f8fa"
        row = 0
        cats = [(c, [k for k, v in STENCILS.items() if v["cat"] == c]) for c in CATEGORIES]
        cats += [(c, ["img:" + n for n in names]) for c, names in self.libs.items() if c != CUSTOM]
        cats.append((CUSTOM, ["img:" + n for n in self.libs[CUSTOM]]))
        opened = self.settings.setdefault("pal_open", {})
        shown = 0
        for cat, keys in cats:
            total = len(keys)
            keys = [k for k in keys if not q or q in self._kind_name(k).lower() or q in cat.lower()]
            if not keys and not (cat == CUSTOM and not q):
                continue
            is_open = bool(q) or opened.get(cat, total <= 40)
            head = tk.Label(self.pal_inner, text="%s %s  (%d)" % ("▾" if is_open else "▸", cat,
                                                                 len(keys) if q else total),
                            bg=bg, fg="#34495e", font=("Segoe UI", 9, "bold"), anchor="w", cursor="hand2")
            head.grid(row=row, column=0, columnspan=3, sticky="ew", padx=6, pady=(8, 2))
            if not q:
                head.bind("<Button-1>", lambda e, c=cat, o=is_open: self._toggle_category(c, not o))
            row += 1
            if is_open:
                cut = bool(q) and shown + len(keys) > 150   # keep the palette quick for broad searches
                if cut:
                    keys = keys[:max(0, 150 - shown)]
                for i, k in enumerate(keys):
                    self._palette_item(k).grid(row=row + i // 3, column=i % 3, padx=3, pady=2)
                shown += len(keys)
                row += (len(keys) + 2) // 3
                if cut:
                    tk.Label(self.pal_inner, text="More matches - type more of the name.", bg=bg,
                             fg="#888888", font=("Segoe UI", 8)).grid(row=row, column=0, columnspan=3)
                    row += 1
            if cat == CUSTOM and is_open:
                tk.Button(self.pal_inner, text="Import icon image...", relief="groove", bg="#ffffff",
                          font=("Segoe UI", 8), command=self._cmd(self.import_icon)).grid(
                    row=row, column=0, columnspan=3, sticky="ew", padx=6, pady=(4, 10))
                row += 1
        self.pal_canvas.yview_moveto(0)

    def _toggle_category(self, cat, is_open):
        self.settings.setdefault("pal_open", {})[cat] = is_open
        self.fill_palette()

    def _kind_name(self, k):
        return k[4:].split("/")[-1] if k.startswith("img:") else STENCILS[k]["name"]

    def _palette_item(self, kind):
        bg = "#f6f8fa"
        f = tk.Frame(self.pal_inner, bg=bg, width=68, height=66)
        f.grid_propagate(False)
        c = tk.Canvas(f, width=56, height=42, bg="#ffffff", highlightthickness=1,
                      highlightbackground="#dde3ea", cursor="hand2")
        c.place(relx=0.5, y=2, anchor="n")
        lab = tk.Label(f, text=self._kind_name(kind), bg=bg, font=("Segoe UI", 7), wraplength=66,
                       fg="#333333")
        lab.place(relx=0.5, y=48, anchor="n")
        st = STENCILS.get(kind)
        w, h = (st["w"], st["h"]) if st else (40, 40)
        if not st and self._ensure_icon(kind[4:]):
            im = self.images.pil(kind[4:])
            if im:
                w, h = im.size
        sc = min(48 / w, 34 / h, 1.0)
        shape = {"id": "_", "kind": kind, "x": 0, "y": 0, "w": w, "h": h, "data": {},
                 "label": "Abc" if kind == "text" else "", "font": 11}
        b = render.TkBackend(c, sc, (58 - w * sc) / 2, (44 - h * sc) / 2, self.images)
        render.draw_shape(b, shape, labels=(kind == "text"))
        for wdg in (c, lab, f):
            wdg.bind("<ButtonPress-1>", lambda e, k=kind: self._pal_press(e, k))
            wdg.bind("<B1-Motion>", self._pal_motion)
            wdg.bind("<ButtonRelease-1>", self._pal_release)
            wdg.bind("<Enter>", lambda e, cc=c: cc.configure(highlightbackground=SEL))
            wdg.bind("<Leave>", lambda e, cc=c: cc.configure(highlightbackground="#dde3ea"))
            if kind.startswith("img:"):
                wdg.bind("<ButtonPress-3>", lambda e, k=kind: self._custom_menu(e, k))
        return f

    def _pal_press(self, e, kind):
        self._pal_drag = {"kind": kind, "x": e.x_root, "y": e.y_root, "moved": False}

    def _pal_motion(self, e):
        d = self._pal_drag
        if d and not d["moved"] and math.hypot(e.x_root - d["x"], e.y_root - d["y"]) > 5:
            d["moved"] = True
            self.root.config(cursor="plus")

    def _pal_release(self, e):
        d, self._pal_drag = self._pal_drag, None
        self.root.config(cursor="")
        if not d:
            return
        self.end_edit(True)
        self.commit_props()
        if d["moved"]:
            if self.root.winfo_containing(e.x_root, e.y_root) is not self.canvas:
                return
            cx, cy = e.x_root - self.canvas.winfo_rootx(), e.y_root - self.canvas.winfo_rooty()
            wx, wy = self.canvas.canvasx(cx) / self.zoom, self.canvas.canvasy(cy) / self.zoom
        else:
            wx, wy = self.view_center()
            n = sum(1 for s in self.page["shapes"]
                    if abs(s["x"] + s["w"] / 2 - snap(wx)) < 1 and abs(s["y"] + s["h"] / 2 - snap(wy)) < 1)
            wx, wy = wx + 30 * n, wy + 30 * n
        self.add_shape(d["kind"], wx, wy)

    def _custom_menu(self, e, kind):
        m = tk.Menu(self.root, tearoff=0)
        m.add_command(label="Remove '%s' from the icon library" % self._kind_name(kind),
                      command=lambda: self._remove_icon(kind[4:]))
        m.tk_popup(e.x_root, e.y_root)

    def _remove_icon(self, key):
        if not messagebox.askyesno(APP_NAME, "Remove icon '%s' from the library?\n"
                                   "Diagrams that already use it keep their copy." % key.split("/")[-1]):
            return
        path = self.icon_files.pop(key, None)
        if path and os.path.exists(path):
            os.remove(path)
        for cat in self.libs:
            self.libs[cat] = [k for k in self.libs[cat] if k != key]
        self.fill_palette()

    def import_icon(self):
        paths = filedialog.askopenfilenames(parent=self.root, title="Import icon images",
                                            filetypes=[("Images", "*.png *.gif *.jpg *.jpeg")])
        if not paths:
            return
        os.makedirs(ICON_DIR, exist_ok=True)
        added = 0
        for p in paths:
            name = os.path.splitext(os.path.basename(p))[0]
            try:
                data = self._icon_png_b64(p)
            except Exception as ex:
                messagebox.showerror(APP_NAME, "Could not read %s:\n%s" % (p, ex))
                continue
            path = os.path.join(ICON_DIR, name + ".png")
            with open(path, "wb") as f:
                f.write(base64.b64decode(data))
            self.images.register(name, data)
            self.icon_files[name] = path
            if name not in self.libs[CUSTOM]:
                self.libs[CUSTOM].append(name)
            added += 1
        self.fill_palette()
        self.set_status("Imported %d icon(s) into the Custom icons library." % added)

    # ================================================================= editing commands
    def add_shape(self, kind, wx, wy):
        self.push_undo()
        w = h = None
        if kind.startswith("img:"):
            name = kind[4:]
            if not self._ensure_icon(name):
                self.undo_stack.pop()
                return messagebox.showerror(APP_NAME, "The icon file for '%s' is missing." % name)
            self.doc["images"][name] = self.images.data[name]
            im = self.images.pil(name)
            if im:
                sc = 64 / max(im.size)
                w, h = round(im.size[0] * sc), round(im.size[1] * sc)
        s = dm.new_shape(self.doc, kind, snap(wx, self.snap_on.get()), snap(wy, self.snap_on.get()), w, h)
        if kind.startswith("img:"):
            s["label"] = self._kind_name(kind)
        self.page["shapes"].append(s)
        self.sel = [s["id"]]
        self.redraw_all()
        self.refresh_props()
        self.set_status("Added %s.  Double-click it to rename; Ctrl+3 to draw links." % self._kind_name(kind))

    def delete_selected(self):
        if not self.sel:
            return
        self.push_undo()
        gone = set(self.sel)
        self.page["shapes"] = [s for s in self.page["shapes"] if s["id"] not in gone]
        alive = {s["id"] for s in self.page["shapes"]}
        self.page["conns"] = [c for c in self.page["conns"]
                              if c["id"] not in gone and c["src"] in alive and c["dst"] in alive]
        self.sel = []
        self.redraw_all()
        self.refresh_props()

    def select_all(self):
        self.sel = [s["id"] for s in self.page["shapes"]] + [c["id"] for c in self.page["conns"]]
        self.draw_overlay()
        self.refresh_props()

    def copy(self):
        shapes = self.sel_shapes()
        if not shapes:
            return
        ids = {s["id"] for s in shapes}
        conns = [c for c in self.page["conns"] if c["src"] in ids and c["dst"] in ids]
        used = {s["kind"][4:] for s in shapes if s["kind"].startswith("img:")}
        self.clip = {"shapes": copy.deepcopy(shapes), "conns": copy.deepcopy(conns),
                     "images": {k: v for k, v in self.doc["images"].items() if k in used}}
        self.paste_count = 0
        self.set_status("Copied %d shape(s)." % len(shapes))

    def cut(self):
        self.copy()
        if self.clip:
            self.delete_selected()

    def paste(self, at=None):
        if not self.clip:
            return
        if at:
            xs = [s["x"] + s["w"] / 2 for s in self.clip["shapes"]]
            ys = [s["y"] + s["h"] / 2 for s in self.clip["shapes"]]
            dx = snap(at[0] - (min(xs) + max(xs)) / 2, self.snap_on.get())
            dy = snap(at[1] - (min(ys) + max(ys)) / 2, self.snap_on.get())
        else:
            self.paste_count += 1
            dx = dy = 20 * self.paste_count
        self._insert_clones(self.clip["shapes"], self.clip["conns"], dx, dy, self.clip["images"])

    def duplicate(self):
        shapes = self.sel_shapes()
        if not shapes:
            return
        ids = {s["id"] for s in shapes}
        conns = [c for c in self.page["conns"] if c["src"] in ids and c["dst"] in ids]
        self._insert_clones(shapes, conns, 20, 20, {})

    def _insert_clones(self, shapes, conns, dx, dy, images):
        self.push_undo()
        for k, v in images.items():
            self.doc["images"].setdefault(k, v)
            self.images.register(k, self.doc["images"][k])
        ns, nc = dm.clone_items(self.doc, shapes, conns, dx, dy)
        self.page["shapes"].extend(ns)
        self.page["conns"].extend(nc)
        self.sel = [s["id"] for s in ns] + [c["id"] for c in nc]
        self.redraw_all()
        self.refresh_props()

    def nudge(self, dx, dy):
        shapes = self.sel_shapes()
        if not shapes:
            return
        self.push_undo()
        for s in shapes:
            s["x"] += dx
            s["y"] += dy
        self.redraw_all()
        self.refresh_props()

    def bring_front(self):
        ids = set(self.sel)
        if not ids:
            return
        self.push_undo()
        sh = self.page["shapes"]
        self.page["shapes"] = [s for s in sh if s["id"] not in ids] + [s for s in sh if s["id"] in ids]
        cn = self.page["conns"]
        self.page["conns"] = [c for c in cn if c["id"] not in ids] + [c for c in cn if c["id"] in ids]
        self.redraw_all()

    def send_back(self):
        ids = set(self.sel)
        if not ids:
            return
        self.push_undo()
        sh = self.page["shapes"]
        self.page["shapes"] = [s for s in sh if s["id"] in ids] + [s for s in sh if s["id"] not in ids]
        cn = self.page["conns"]
        self.page["conns"] = [c for c in cn if c["id"] in ids] + [c for c in cn if c["id"] not in ids]
        self.redraw_all()

    def align(self, how):
        shapes = self.sel_shapes()
        if len(shapes) < 2:
            return self.set_status("Select two or more shapes to align (the first selected is the reference).")
        self.push_undo()
        ref = shapes[0]
        for s in shapes[1:]:
            if how == "left":
                s["x"] = ref["x"]
            elif how == "right":
                s["x"] = ref["x"] + ref["w"] - s["w"]
            elif how == "hcenter":
                s["x"] = ref["x"] + ref["w"] / 2 - s["w"] / 2
            elif how == "top":
                s["y"] = ref["y"]
            elif how == "bottom":
                s["y"] = ref["y"] + ref["h"] - s["h"]
            elif how == "vcenter":
                s["y"] = ref["y"] + ref["h"] / 2 - s["h"] / 2
        self.redraw_all()
        self.refresh_props()

    def distribute(self, axis):
        shapes = self.sel_shapes()
        if len(shapes) < 3:
            return self.set_status("Select three or more shapes to distribute.")
        self.push_undo()
        k, size = ("x", "w") if axis == "h" else ("y", "h")
        shapes.sort(key=lambda s: s[k] + s[size] / 2)
        a = shapes[0][k] + shapes[0][size] / 2
        b = shapes[-1][k] + shapes[-1][size] / 2
        step = (b - a) / (len(shapes) - 1)
        for i, s in enumerate(shapes):
            s[k] = a + i * step - s[size] / 2
        self.redraw_all()
        self.refresh_props()

    def same_size(self):
        shapes = self.sel_shapes()
        if len(shapes) < 2:
            return
        self.push_undo()
        ref = shapes[0]
        for s in shapes[1:]:
            cx, cy = s["x"] + s["w"] / 2, s["y"] + s["h"] / 2
            s["w"], s["h"] = ref["w"], ref["h"]
            s["x"], s["y"] = cx - s["w"] / 2, cy - s["h"] / 2
        self.redraw_all()
        self.refresh_props()

    def set_conn_field(self, key, value):
        conns = self.sel_conns()
        if not conns:
            return self.set_status("Select one or more connectors first.")
        self.push_undo()
        for c in conns:
            c[key] = value
        self.redraw_all()
        self.refresh_props()

    def reverse_conns(self):
        conns = self.sel_conns()
        if not conns:
            return
        self.push_undo()
        for c in conns:
            c["src"], c["dst"] = c["dst"], c["src"]
            c["src_label"], c["dst_label"] = c.get("dst_label", ""), c.get("src_label", "")
        self.redraw_all()
        self.refresh_props()

    # ================================================================= pages
    def rebuild_page_tabs(self):
        bar = self.page_bar
        for w in bar.winfo_children():
            w.destroy()
        for i, p in enumerate(self.doc["pages"]):
            cur = i == self.page_idx
            b = tk.Label(bar, text="  %s  " % p["name"], bg="#ffffff" if cur else "#e9edf2",
                         fg="#1b2f45", font=("Segoe UI", 9, "bold" if cur else "normal"),
                         relief="solid" if cur else "flat", bd=1, padx=4, pady=3, cursor="hand2")
            b.pack(side="left", padx=(4 if i == 0 else 1, 0), pady=(0, 3))
            b.bind("<Button-1>", lambda e, i=i: self._cmd(lambda: self.switch_page(i))())
            b.bind("<Double-Button-1>", lambda e: self._cmd(self.rename_page)())
            b.bind("<Button-3>", lambda e, i=i: self._page_menu(e, i))
        add = tk.Label(bar, text=" + ", bg="#e9edf2", fg="#1b2f45", font=("Segoe UI", 10, "bold"),
                       cursor="hand2")
        add.pack(side="left", padx=4)
        add.bind("<Button-1>", lambda e: self._cmd(self.new_page)())
        self._tooltip(add, "Add a page")

    def _page_menu(self, e, i):
        self._cmd(lambda: self.switch_page(i))()
        C = self._cmd
        m = tk.Menu(self.root, tearoff=0)
        m.add_command(label="Rename...", command=C(self.rename_page))
        m.add_command(label="Duplicate", command=C(self.duplicate_page))
        m.add_command(label="Move left", command=C(lambda: self.move_page(-1)))
        m.add_command(label="Move right", command=C(lambda: self.move_page(1)))
        m.add_separator()
        m.add_command(label="Delete", command=C(self.delete_page))
        m.tk_popup(e.x_root, e.y_root)

    def switch_page(self, i):
        if i == self.page_idx:
            return
        self.page_idx = i
        self.sel = []
        self.rebuild_page_tabs()
        self.redraw_all()
        self.refresh_props()

    def new_page(self):
        self.push_undo()
        names = {p["name"] for p in self.doc["pages"]}
        n = len(self.doc["pages"]) + 1
        while "Page-%d" % n in names:
            n += 1
        self.doc["pages"].append(dm.new_page("Page-%d" % n))
        self.page_idx = len(self.doc["pages"]) - 1
        self.sel = []
        self.rebuild_page_tabs()
        self.redraw_all()
        self.refresh_props()

    def duplicate_page(self):
        self.push_undo()
        src = self.page
        ns, nc = dm.clone_items(self.doc, src["shapes"], src["conns"])
        p = {"name": src["name"] + " (copy)", "shapes": ns, "conns": nc}
        self.doc["pages"].insert(self.page_idx + 1, p)
        self.page_idx += 1
        self.sel = []
        self.rebuild_page_tabs()
        self.redraw_all()
        self.refresh_props()

    def rename_page(self):
        name = simpledialog.askstring(APP_NAME, "Page name:", initialvalue=self.page["name"], parent=self.root)
        if name and name.strip() and name.strip() != self.page["name"]:
            self.push_undo()
            self.page["name"] = name.strip()
            self.rebuild_page_tabs()

    def move_page(self, step):
        j = self.page_idx + step
        if 0 <= j < len(self.doc["pages"]):
            self.push_undo()
            pages = self.doc["pages"]
            pages[self.page_idx], pages[j] = pages[j], pages[self.page_idx]
            self.page_idx = j
            self.rebuild_page_tabs()

    def delete_page(self):
        if len(self.doc["pages"]) == 1:
            return messagebox.showinfo(APP_NAME, "A diagram needs at least one page.")
        if self.page["shapes"] and not messagebox.askyesno(APP_NAME, "Delete page '%s' and everything on it?"
                                                           % self.page["name"]):
            return
        self.push_undo()
        del self.doc["pages"][self.page_idx]
        self.page_idx = max(0, self.page_idx - 1)
        self.sel = []
        self.rebuild_page_tabs()
        self.redraw_all()
        self.refresh_props()

    # ================================================================= files
    def _confirm_discard(self):
        if not self.modified:
            return True
        ans = messagebox.askyesnocancel(APP_NAME, "Save changes to %s?" %
                                        (os.path.basename(self.path) if self.path else "this diagram"))
        if ans is None:
            return False
        return self.save() if ans else True

    def _reset(self, doc, path):
        self.doc = doc
        self.path = path
        self.page_idx = 0
        self.sel = []
        self.undo_stack.clear()
        self.redo_stack.clear()
        self.modified = False
        for k, v in doc.get("images", {}).items():
            self.images.register(k, v)
        self.rebuild_page_tabs()
        self.update_title()
        self.refresh_props()

    def new_file(self):
        if not self._confirm_discard():
            return
        self._reset(dm.new_doc(), None)
        self.zoom = 1.0
        self.redraw_all()
        self._scroll_to(-40, -40)

    def open_dialog(self):
        if not self._confirm_discard():
            return
        p = filedialog.askopenfilename(parent=self.root, title="Open diagram",
                                       initialdir=self.settings.get("last_dir"),
                                       filetypes=[("Network diagrams", "*" + FILE_EXT), ("All files", "*.*")])
        if p:
            self.open_file(p)

    def open_file(self, p):
        try:
            doc = dm.load(p)
        except Exception as ex:
            return messagebox.showerror(APP_NAME, "Could not open %s:\n%s" % (p, ex))
        self.settings["last_dir"] = os.path.dirname(p)
        self._reset(doc, p)
        self.fit()
        self.set_status("Opened %s" % p)

    def save(self):
        if not self.path:
            return self.save_as()
        try:
            dm.save(self.doc, self.path)
        except OSError as ex:
            messagebox.showerror(APP_NAME, "Could not save:\n%s" % ex)
            return False
        self.modified = False
        self.update_title()
        self.set_status("Saved %s" % self.path)
        return True

    def save_as(self):
        p = filedialog.asksaveasfilename(parent=self.root, title="Save diagram as", defaultextension=FILE_EXT,
                                         initialdir=self.settings.get("last_dir"),
                                         initialfile=os.path.basename(self.path) if self.path else "Network Diagram",
                                         filetypes=[("Network diagrams", "*" + FILE_EXT)])
        if not p:
            return False
        self.path = p
        self.settings["last_dir"] = os.path.dirname(p)
        return self.save()

    def _export_name(self, ext, suffix=True):
        base = os.path.splitext(os.path.basename(self.path))[0] if self.path else "Network Diagram"
        if suffix and len(self.doc["pages"]) > 1:
            base += " - " + self.page["name"]
        return base + ext

    def _ask_export(self, ext, label, suffix=True):
        p = filedialog.asksaveasfilename(parent=self.root, title="Export " + label, defaultextension=ext,
                                         initialdir=self.settings.get("last_dir"),
                                         initialfile=self._export_name(ext, suffix),
                                         filetypes=[(label, "*" + ext)])
        if p:
            self.settings["last_dir"] = os.path.dirname(p)
        return p

    def export_png(self):
        p = self._ask_export(".png", "PNG image")
        if not p:
            return
        try:
            img = dm.page_to_image(self.page, self.images, scale=2.0)
            img.save(p, dpi=(192, 192))
        except Exception as ex:
            return messagebox.showerror(APP_NAME, "Export failed:\n%s" % ex)
        self.set_status("Exported %s (%d x %d px)" % (p, img.size[0], img.size[1]))

    def export_svg(self):
        p = self._ask_export(".svg", "SVG drawing")
        if not p:
            return
        try:
            svg = dm.page_to_svg(self.page, self.images)
            with open(p, "w", encoding="utf-8") as f:
                f.write(svg)
        except Exception as ex:
            return messagebox.showerror(APP_NAME, "Export failed:\n%s" % ex)
        self.set_status("Exported %s" % p)

    def export_pdf(self):
        p = self._ask_export(".pdf", "PDF document", suffix=False)
        if not p:
            return
        try:
            imgs = [dm.page_to_image(pg, self.images, scale=2.0).convert("RGB")
                    for pg in self.doc["pages"] if pg["shapes"]]
            if not imgs:
                raise ValueError("All pages are empty.")
            imgs[0].save(p, "PDF", resolution=192, save_all=True, append_images=imgs[1:])
        except Exception as ex:
            return messagebox.showerror(APP_NAME, "Export failed:\n%s" % ex)
        self.set_status("Exported %d page(s) to %s" % (len(imgs), p))

    def copy_image(self):
        try:
            import io
            import win32clipboard
            img = dm.page_to_image(self.page, self.images, scale=1.5).convert("RGB")
            buf = io.BytesIO()
            img.save(buf, "BMP")
            win32clipboard.OpenClipboard()
            try:
                win32clipboard.EmptyClipboard()
                win32clipboard.SetClipboardData(win32clipboard.CF_DIB, buf.getvalue()[14:])
            finally:
                win32clipboard.CloseClipboard()
        except ImportError:
            return messagebox.showerror(APP_NAME, "Copying images needs pywin32 (run setup.bat).")
        except Exception as ex:
            return messagebox.showerror(APP_NAME, "Copy failed:\n%s" % ex)
        self.set_status("Page copied to the clipboard - paste it into Word, PowerPoint or Outlook.")

    def export_inventory(self):
        p = self._ask_export(".xlsx", "Excel workbook", suffix=False)
        if not p:
            return
        try:
            nd, nl = dm.export_inventory(self.doc, p)
        except Exception as ex:
            return messagebox.showerror(APP_NAME, "Export failed:\n%s" % ex)
        self.set_status("Exported %d devices and %d links to %s" % (nd, nl, p))
        if messagebox.askyesno(APP_NAME, "Inventory exported (%d devices, %d links).\nOpen it now?" % (nd, nl)):
            os.startfile(p)

    # ================================================================= keys / close
    def _bind_keys(self):
        r = self.root
        C = self._cmd

        def guard(fn):
            def run(e):
                if isinstance(self.root.focus_get(), TEXT_INPUTS):
                    return None
                return C(fn)()
            return run

        for seq, fn in (("<Control-n>", self.new_file), ("<Control-o>", self.open_dialog),
                        ("<Control-s>", self.save), ("<Control-S>", self.save_as),
                        ("<Control-C>", self.copy_image), ("<Control-F>", self.bring_front),
                        ("<Control-B>", self.send_back), ("<Control-W>", self.fit)):
            r.bind(seq, C(fn))
        for seq, fn in (("<Control-z>", self.undo), ("<Control-y>", self.redo), ("<Control-c>", self.copy),
                        ("<Control-x>", self.cut), ("<Control-v>", self.paste), ("<Control-d>", self.duplicate),
                        ("<Control-a>", self.select_all), ("<Delete>", self.delete_selected),
                        ("<F2>", self.edit_selected_label)):
            r.bind(seq, guard(fn))
        r.bind("<Control-Key-1>", lambda e: self.tool.set("select"))
        r.bind("<Control-Key-3>", lambda e: self.tool.set("connect"))
        r.bind("<Escape>", lambda e: self._escape())
        for seq in ("<Control-plus>", "<Control-equal>", "<Control-KP_Add>"):
            r.bind(seq, lambda e: self.set_zoom(self.zoom * 1.25))
        for seq in ("<Control-minus>", "<Control-KP_Subtract>"):
            r.bind(seq, lambda e: self.set_zoom(self.zoom / 1.25))
        r.bind("<Control-Key-0>", lambda e: self.set_zoom(1.0))
        for key, dx, dy in (("Left", -1, 0), ("Right", 1, 0), ("Up", 0, -1), ("Down", 0, 1)):
            r.bind("<%s>" % key, guard(lambda dx=dx, dy=dy: self.nudge(dx * GRID, dy * GRID)))
            r.bind("<Shift-%s>" % key, guard(lambda dx=dx, dy=dy: self.nudge(dx, dy)))

    def _escape(self):
        if self.drag and self.drag["mode"] == "connect":
            self.canvas.delete(self.drag["line"])
            self.drag = None
        if self.tool.get() != "select":
            self.tool.set("select")
        elif self.sel and not isinstance(self.root.focus_get(), TEXT_INPUTS):
            self.sel = []
            self.draw_overlay()
            self.refresh_props()

    def show_help(self):
        messagebox.showinfo(APP_NAME, (
            "Adding shapes\n"
            "  - Drag a shape from the palette onto the page, or click it to drop it in the middle.\n"
            "  - Import your own PNG icons (e.g. vendor icon sets) under Custom icons.\n\n"
            "Linking\n"
            "  - Ctrl+3 (Connector tool), then drag from one shape to another. Esc goes back.\n"
            "  - Set port labels (Gi1/0/1), link label, routing, arrows and dash in Properties.\n"
            "  - Several links between the same two devices are spread apart automatically.\n\n"
            "Editing\n"
            "  - Double-click or F2 to edit a label (Shift+Enter for a new line).\n"
            "  - Shift/Ctrl+click adds to the selection; drag on empty space to box-select.\n"
            "  - Drag the handles to resize (Shift keeps the proportions).\n"
            "  - Arrow keys nudge by the grid, Shift+arrow by 1 px; hold Alt while dragging to skip snapping.\n"
            "  - Zones move the devices inside them.  Align/distribute is under Arrange.\n\n"
            "View\n"
            "  - Ctrl+wheel zoom, wheel scroll, Shift+wheel horizontal, middle-drag pan.\n\n"
            "Output\n"
            "  - File > Export PNG / SVG / PDF (all pages), Copy page as image (Ctrl+Shift+C).\n"
            "  - File > Export inventory: Excel sheet of devices (IP, model, serial) and links."))

    def on_close(self):
        self.end_edit(True)
        self.commit_props()
        if not self._confirm_discard():
            return
        self.settings.update(conn_style=self.conn_style.get(), show_grid=self.show_grid.get(),
                             snap=self.snap_on.get(), zoomed=self.root.state() == "zoomed")
        if self.root.state() == "normal":
            self.settings["geometry"] = self.root.geometry()
        save_settings(self.settings)
        self.root.destroy()


def main():
    try:
        import ctypes
        ctypes.windll.shcore.SetProcessDpiAwareness(1)
    except Exception:
        pass
    root = tk.Tk()
    App(root, sys.argv[1] if len(sys.argv) > 1 else None)
    root.mainloop()


if __name__ == "__main__":
    main()
