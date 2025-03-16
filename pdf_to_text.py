import PyPDF2

def convert_pdf_to_text(pdf_path, output_path):
    # Open the PDF file in binary read mode
    with open(pdf_path, 'rb') as file:
        # Create a PDF reader object
        pdf_reader = PyPDF2.PdfReader(file)
        
        # Get the number of pages
        num_pages = len(pdf_reader.pages)
        
        # Open text file in write mode
        with open(output_path, 'w', encoding='utf-8') as text_file:
            # Iterate through all pages and extract text
            for page_num in range(num_pages):
                # Get the page object
                page = pdf_reader.pages[page_num]
                
                # Extract text from the page
                text = page.extract_text()
                
                # Write the text to file with page number
                text_file.write(f"\n\n=== Page {page_num + 1} ===\n\n")
                text_file.write(text)

if __name__ == "__main__":
    # Convert the API documentation PDF to text
    convert_pdf_to_text("API Reference - OpenAI API.pdf", "api_reference.txt")
    print("Conversion complete! Check api_reference.txt for the output.") 