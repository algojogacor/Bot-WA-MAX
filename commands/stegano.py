from PIL import Image
import os
import sys

# --- FUNGSI BANTUAN ---
def text_to_bin(message):
    """Mengubah teks menjadi deretan biner."""
    return ''.join(format(ord(i), '08b') for i in message)

def bin_to_text(binary_data):
    """Mengubah deretan biner kembali menjadi teks."""
    all_bytes = [binary_data[i: i+8] for i in range(0, len(binary_data), 8)]
    return "".join([chr(int(byte, 2)) for byte in all_bytes])

# --- FUNGSI UTAMA ---
def sembunyikan_pesan(image_path, secret_message, output_path):
    # print(f"[PROSES] Menyembunyikan pesan di: {image_path}...")
    try:
        img = Image.open(image_path)
        img = img.convert("RGB") # Pastikan mode RGB
        pixels = img.load()
    except FileNotFoundError:
        print("Error: File gambar tidak ditemukan!")
        return

    # Tambahkan "STOP" (#####) di akhir pesan sebagai penanda berhenti
    full_message = secret_message + "#####"
    binary_message = text_to_bin(full_message)
    message_len = len(binary_message)
    
    width, height = img.size
    total_pixels = width * height
    
    # Cek kapasitas
    if message_len > total_pixels * 3:
        print("Error: Pesan terlalu panjang untuk ukuran gambar ini!")
        return

    data_index = 0
    
    for y in range(height):
        for x in range(width):
            if data_index < message_len:
                r, g, b = pixels[x, y]
                
                # Ubah LSB (Least Significant Bit)
                if data_index < message_len:
                    r = (r & ~1) | int(binary_message[data_index])
                    data_index += 1
                if data_index < message_len:
                    g = (g & ~1) | int(binary_message[data_index])
                    data_index += 1
                if data_index < message_len:
                    b = (b & ~1) | int(binary_message[data_index])
                    data_index += 1
                
                pixels[x, y] = (r, g, b)
            else:
                break
        if data_index >= message_len:
            break
            
    img.save(output_path, "PNG")
    print(f"SUKSES: Pesan tersimpan di {output_path}")

def baca_pesan(image_path):
    # print(f"[PROSES] Membaca gambar: {image_path}...")
    try:
        img = Image.open(image_path)
        pixels = img.load()
    except FileNotFoundError:
        print("Error: File gambar tidak ditemukan!")
        return

    binary_data = ""
    width, height = img.size
    
    for y in range(height):
        for x in range(width):
            r, g, b = pixels[x, y]
            
            binary_data += str(r & 1)
            binary_data += str(g & 1)
            binary_data += str(b & 1)
            
    # Convert biner ke teks
    all_bytes = [binary_data[i: i+8] for i in range(0, len(binary_data), 8)]
    
    decoded_text = ""
    for byte in all_bytes:
        try:
            decoded_text += chr(int(byte, 2))
        except ValueError:
            continue
            
        if decoded_text.endswith("#####"):
            # Cetak HANYA pesan bersihnya agar rapi di WA
            print(decoded_text[:-5]) 
            return
            
    print("ZONK: Tidak ada pesan rahasia di gambar ini.")

# --- EXECUTION HANDLER ---
if __name__ == "__main__":
    # Script ini sekarang dikendalikan oleh command line arguments (CLI)
    
    if len(sys.argv) < 2:
        print("Usage: python stegano.py [mode] [args...]")
        sys.exit(1)

    mode = sys.argv[1] # 'hide' atau 'reveal'

    if mode == "hide":
        # python stegano.py hide [input] [pesan] [output]
        if len(sys.argv) < 5:
            print("Error: Argumen kurang untuk hide.")
        else:
            img_input = sys.argv[2]
            pesan = sys.argv[3]
            img_output = sys.argv[4]
            sembunyikan_pesan(img_input, pesan, img_output)
            
    elif mode == "reveal":
        # python stegano.py reveal [input]
        if len(sys.argv) < 3:
            print("Error: Argumen kurang untuk reveal.")
        else:
            img_input = sys.argv[2]
            baca_pesan(img_input)
