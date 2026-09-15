"""Integração Windows: bandeja e inicialização automática."""
from __future__ import annotations
import os, sys, threading, winreg
import pystray
from PIL import Image, ImageDraw

APP_NAME="Lojamix Sync"
RUN_KEY=r"Software\Microsoft\Windows\CurrentVersion\Run"

def is_windows(): return sys.platform.startswith("win")
def exe_path():
    return os.path.abspath(sys.executable if getattr(sys,"frozen",False) else sys.argv[0])

def startup_enabled():
    if not is_windows(): return False
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER,RUN_KEY,0,winreg.KEY_READ) as k:
            v,_=winreg.QueryValueEx(k,APP_NAME)
            return bool(v)
    except (FileNotFoundError,OSError): return False

def set_startup(enabled):
    if not is_windows() or not getattr(sys,"frozen",False): return False
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER,RUN_KEY,0,winreg.KEY_SET_VALUE) as k:
            if enabled: winreg.SetValueEx(k,APP_NAME,0,winreg.REG_SZ,exe_path())
            else:
                try: winreg.DeleteValue(k,APP_NAME)
                except FileNotFoundError: pass
        return True
    except OSError: return False

def icon_image(size=64):
    img=Image.new("RGBA",(size,size),(0,0,0,0)); d=ImageDraw.Draw(img)
    d.rounded_rectangle((5,5,size-5,size-5),radius=12,fill=(30,115,190,255))
    d.rectangle((18,18,46,46),outline="white",width=3)
    d.line((24,31,40,31),fill="white",width=3)
    d.line((24,38,40,38),fill="white",width=3)
    return img

class TrayController:
    def __init__(self,app):
        self.app=app; self.icon=None; self.thread=None
    def start(self):
        if not is_windows(): return
        menu=pystray.Menu(
            pystray.MenuItem("Abrir Lojamix Sync",lambda *_: self.open(),default=True),
            pystray.MenuItem("Sincronizar agora",lambda *_: self.app.after(0,self.app.sync_now)),
            pystray.MenuItem("Atualizar status",lambda *_: self.app.after(0,self.app.refresh_status)),
            pystray.MenuItem("Configurações",lambda *_: self.app.after(0,self.app.open_config)),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Iniciar com Windows",lambda *_: self.toggle(),
                             checked=lambda item: startup_enabled()),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Sair",lambda *_: self.app.after(0,self.app.quit_from_tray)),
        )
        self.icon=pystray.Icon(APP_NAME,icon_image(),APP_NAME,menu)
        self.thread=threading.Thread(target=self.icon.run,name="LojamixTray",daemon=True)
        self.thread.start()
    def open(self):
        self.app.after(0,self.app.deiconify); self.app.after(0,self.app.lift); self.app.after(0,self.app.focus_force)
    def toggle(self):
        ok=set_startup(not startup_enabled())
        self.app.after(0,lambda:self.app.show_startup_result(ok))
    def stop(self):
        if self.icon:
            try:self.icon.stop()
            except Exception:pass
