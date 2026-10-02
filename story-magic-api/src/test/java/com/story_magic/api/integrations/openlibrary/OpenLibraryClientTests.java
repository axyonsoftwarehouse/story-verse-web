package com.story_magic.api.integrations.openlibrary;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import java.util.List;

import org.junit.jupiter.api.Test;

class OpenLibraryClientTests {

	@Test
	void parsesOpenLibrarySnakeCaseFields() throws Exception {
		String response = """
				{
				  "docs": [{
				    "title": "Twilight",
				    "author_name": ["Stephenie Meyer"],
				    "first_publish_year": 2005,
				    "cover_i": 54321,
				    "edition_count": 20,
				    "editions": {
				      "docs": [{
				        "title": "Crepúsculo",
				        "language": ["por"],
				        "cover_i": 12345
				      }]
				    }
				  }]
				}
				""";

		List<OpenLibraryBookDocument> documents = OpenLibraryClient.parseResponse(response);

		assertEquals(1, documents.size());
		assertEquals("Stephenie Meyer", documents.getFirst().author_name().getFirst());
		assertEquals(2005, documents.getFirst().first_publish_year());
		assertNotNull(documents.getFirst().editions());
		assertEquals("Crepúsculo", documents.getFirst().editions().docs().getFirst().title());
		assertEquals("por", documents.getFirst().editions().docs().getFirst().language().getFirst());
	}
}
