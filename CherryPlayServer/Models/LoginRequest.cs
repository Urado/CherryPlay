using System.ComponentModel.DataAnnotations;

namespace CherryPlayServer.Models;

public record LoginRequest(
    [Required]
    [EmailAddress]
    string Email,
    [Required]
    string Password
);
