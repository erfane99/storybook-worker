private isPlaceholderValue(value: string | undefined): boolean {
    if (!value) return true;
    
    const placeholderPatterns = [
      'your_',
      'placeholder',
      'example',
      'test_key',
      'demo_',
      // 'sk-proj-',  // ← REMOVED: This is a valid OpenAI key format!
      'localhost',
      'http://localhost'
    ];

    return placeholderPatterns.some(pattern => 
      value.toLowerCase().includes(pattern.toLowerCase())
    );
  }