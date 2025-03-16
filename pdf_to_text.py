import PyPDF2
import os
import re
import json
from pathlib import Path
import openai
from collections import defaultdict
import hashlib

class PDFProcessor:
    def __init__(self):
        self.stats = defaultdict(int)
        # Try to get API key from environment
        self.api_key = os.getenv('OPENAI_API_KEY')
        if self.api_key:
            openai.api_key = self.api_key

    def get_pdf_files(self):
        """List all PDF files in the current directory."""
        return [f for f in os.listdir('.') if f.lower().endswith('.pdf')]

    def extract_text_from_pdf(self, pdf_path):
        """Extract raw text from PDF."""
        self.stats['original_chars'] = 0
        text_by_page = []
        
        try:
            with open(pdf_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                for page_num in range(len(pdf_reader.pages)):
                    page = pdf_reader.pages[page_num]
                    text = page.extract_text()
                    self.stats['original_chars'] += len(text)
                    text_by_page.append(text)
                
            return text_by_page
        except Exception as e:
            print(f"Error reading PDF: {e}")
            return []

    def initial_cleanup(self, text_by_page):
        """First pass cleanup of obvious formatting issues."""
        cleaned_pages = []
        self.stats['after_initial_cleanup_chars'] = 0
        
        for page_text in text_by_page:
            # Remove repeated whitespace
            text = re.sub(r'\s+', ' ', page_text)
            
            # Remove common PDF artifacts
            text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\xff]', '', text)
            
            # Remove repeated line numbers
            text = re.sub(r'^\s*\d+\s*$', '', text, flags=re.MULTILINE)
            
            # Remove headers/footers that appear on every page (customize based on your PDFs)
            text = re.sub(r'Page \d+ of \d+', '', text)
            
            # Remove duplicate adjacent lines
            lines = text.split('\n')
            unique_lines = []
            prev_line_hash = None
            for line in lines:
                line_hash = hashlib.md5(line.strip().encode()).hexdigest()
                if line_hash != prev_line_hash:
                    unique_lines.append(line)
                prev_line_hash = line_hash
            
            text = '\n'.join(unique_lines)
            self.stats['after_initial_cleanup_chars'] += len(text)
            cleaned_pages.append(text)
        
        return cleaned_pages

    def content_analysis(self, text_by_page):
        """Analyze and clean content based on semantic understanding."""
        self.stats['after_content_analysis_chars'] = 0
        processed_pages = []
        
        for page_text in text_by_page:
            # Split into paragraphs
            paragraphs = re.split(r'\n\s*\n', page_text)
            
            valid_paragraphs = []
            for para in paragraphs:
                # Skip if too short or looks like a header/footer
                if len(para.strip()) < 10:
                    continue
                    
                # Skip if it's just numbers or special characters
                if re.match(r'^[\d\W\s]+$', para.strip()):
                    continue
                
                # Skip if it looks like a navigation element or repeated UI text
                if re.match(r'^(next|previous|page|chapter|\d+)\s*$', para.strip(), re.I):
                    continue
                
                valid_paragraphs.append(para)
            
            processed_text = '\n\n'.join(valid_paragraphs)
            self.stats['after_content_analysis_chars'] += len(processed_text)
            processed_pages.append(processed_text)
        
        return processed_pages

    def llm_cleanup(self, text_by_page):
        """Use OpenAI API to clean and structure the content."""
        if not self.api_key:
            print("No OpenAI API key found. Skipping LLM cleanup.")
            return text_by_page

        self.stats['after_llm_cleanup_chars'] = 0
        processed_pages = []
        
        try:
            for page_text in text_by_page:
                # Skip empty pages
                if not page_text.strip():
                    continue
                    
                # Process in chunks if the text is too long
                chunks = [page_text[i:i+4000] for i in range(0, len(page_text), 4000)]
                cleaned_chunks = []
                
                for chunk in chunks:
                    response = openai.ChatCompletion.create(
                        model="gpt-3.5-turbo",
                        messages=[
                            {"role": "system", "content": "You are a document cleaning assistant. Your task is to:\n"
                                                        "1. Remove any remaining formatting artifacts\n"
                                                        "2. Preserve all technical content and code examples\n"
                                                        "3. Maintain the original structure of the documentation\n"
                                                        "4. Remove redundant information\n"
                                                        "5. Format the output in a clean, consistent way\n"
                                                        "Return only the cleaned text without any explanations."},
                            {"role": "user", "content": chunk}
                        ],
                        temperature=0.0
                    )
                    cleaned_text = response.choices[0].message.content
                    cleaned_chunks.append(cleaned_text)
                
                processed_text = '\n'.join(cleaned_chunks)
                self.stats['after_llm_cleanup_chars'] += len(processed_text)
                processed_pages.append(processed_text)
                
        except Exception as e:
            print(f"Error in LLM processing: {e}")
            return text_by_page
            
        return processed_pages

    def save_output(self, text_by_page, output_path):
        """Save the processed text to a file."""
        try:
            with open(output_path, 'w', encoding='utf-8') as f:
                for i, page_text in enumerate(text_by_page, 1):
                    f.write(f"\n=== Page {i} ===\n\n")
                    f.write(page_text)
                    f.write('\n')
            
            # Save statistics
            stats_path = output_path + '.stats.json'
            with open(stats_path, 'w') as f:
                json.dump(self.stats, f, indent=2)
                
        except Exception as e:
            print(f"Error saving output: {e}")

def main():
    processor = PDFProcessor()
    pdf_files = processor.get_pdf_files()
    
    if not pdf_files:
        print("No PDF files found in the current directory.")
        return

    # List available PDFs
    print("\nAvailable PDF files:")
    for i, pdf in enumerate(pdf_files, 1):
        print(f"{i}. {pdf}")

    # Get user selection
    while True:
        try:
            choice = input("\nEnter the number of the PDF to process (or 'q' to quit): ")
            if choice.lower() == 'q':
                return
            
            idx = int(choice) - 1
            if 0 <= idx < len(pdf_files):
                pdf_path = pdf_files[idx]
                break
            else:
                print("Invalid selection. Please try again.")
        except ValueError:
            print("Please enter a valid number.")

    print(f"\nProcessing {pdf_path}...")
    
    # Extract text
    print("Extracting text...")
    text_by_page = processor.extract_text_from_pdf(pdf_path)

    # Initial cleanup
    print("Performing initial cleanup...")
    text_by_page = processor.initial_cleanup(text_by_page)

    # Content analysis
    print("Analyzing content...")
    text_by_page = processor.content_analysis(text_by_page)

    # LLM cleanup
    print("Performing LLM cleanup...")
    text_by_page = processor.llm_cleanup(text_by_page)

    # Save output
    output_path = Path(pdf_path).stem + '_cleaned.txt'
    processor.save_output(text_by_page, output_path)

    # Display statistics
    stats = processor.stats
    print("\nProcessing Statistics:")
    print(f"Original size: {stats['original_chars']:,} chars")
    print(f"After initial cleanup: {stats['after_initial_cleanup_chars']:,} chars "
          f"({stats['after_initial_cleanup_chars']/stats['original_chars']*100:.1f}%)")
    print(f"After content analysis: {stats['after_content_analysis_chars']:,} chars "
          f"({stats['after_content_analysis_chars']/stats['original_chars']*100:.1f}%)")
    if 'after_llm_cleanup_chars' in stats:
        print(f"After LLM cleanup: {stats['after_llm_cleanup_chars']:,} chars "
              f"({stats['after_llm_cleanup_chars']/stats['original_chars']*100:.1f}%)")

    print(f"\nProcessing complete! Output saved to {output_path}")
    print(f"Statistics saved to {output_path}.stats.json")

if __name__ == "__main__":
    main() 