import sys
import subprocess
import os

def install_packages():
    required_packages = ['qrcode', 'pillow', 'requests']
    for package in required_packages:
        try:
            __import__(package if package != 'pillow' else 'PIL')
        except ImportError:
            print(f"Installing {package}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", package])

# Install requirements first
install_packages()

import qrcode
import requests

def get_ngrok_url():
    try:
        # ngrok's local API usually runs on port 4040
        response = requests.get('http://localhost:4040/api/tunnels', timeout=2)
        response.raise_for_status()
        tunnels = response.json().get('tunnels', [])
        if tunnels:
            # We want the public_url of the first tunnel, usually the HTTPS one
            public_url = tunnels[0].get('public_url')
            if public_url:
                return public_url
    except Exception as e:
        pass
    return None

def main():
    print("Checking for active ngrok tunnels...")
    base_url = get_ngrok_url()
    
    if base_url:
        print(f"Found ngrok URL: {base_url}")
    else:
        print("ngrok API not reachable or no tunnels found.")
        base_url = input("Please enter the public URL manually (e.g., https://my-tunnel.ngrok-free.app): ").strip()
        
        # Ensure it has http/https
        if base_url and not base_url.startswith('http'):
            base_url = 'https://' + base_url

    if not base_url:
        print("No URL provided. Exiting.")
        sys.exit(1)

    # Append /player/ to the base url
    if not base_url.endswith('/'):
        base_url += '/'
    player_url = base_url + 'player/'

    print(f"\n[+] Full Player URL: {player_url}\n")

    print("Generating QR code...")
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(player_url)
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
