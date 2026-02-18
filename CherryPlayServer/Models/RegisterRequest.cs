using System.ComponentModel.DataAnnotations;

namespace CherryPlayServer.Models;

public record RegisterRequest(
    [Required]
    [EmailAddress]
    string Email,
    [Required]
    [MinLength(6)]
    string Password,
    [Required]
    string Name
);
