import sys
import subprocess
import os

def install_packages():
    required_packages = ['qrcode', 'pillow']
    for package in required_packages:
        try:
            __import__(package if package != 'pillow' else 'PIL')
        except ImportError:
            print(f"Installing {package}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", package])

# Install requirements first
install_packages()

import qrcode

def main():
    PLAYER_URL = 'http://172.31.3.109:4521/player/'
    print(f"\n[+] Full Player URL: {PLAYER_URL}\n")

    print("Generating QR code...")
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(PLAYER_URL)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    
    qr_filename = 'player_qr.png'
    img.save(qr_filename)
    
    print(f"QR code saved to {qr_filename}")
    
    # Open the file automatically on Windows
    if os.name == 'nt':
        os.startfile(qr_filename)
    else:
        print("Please open player_qr.png manually (auto-open only supported on Windows).")

if __name__ == "__main__":
    main()
